-- =====================================================================
-- That AIn't Right — database schema
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to re-run: functions are replaced, tables are created if missing.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------
-- The game "day" rolls over at midnight in this timezone.
-- Keep in sync with NEXT_PUBLIC_APP_TIMEZONE.
create or replace function public.app_today() returns date
language sql stable as $$
  select (now() at time zone 'America/New_York')::date
$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  handle       text unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  phone_e164   text unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  invite_code  text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_at   timestamptz not null default now()
);

create table if not exists public.puzzles (
  id          uuid primary key default gen_random_uuid(),
  puzzle_date date not null unique,
  status      text not null default 'draft' check (status in ('draft', 'published')),
  created_at  timestamptz not null default now()
);

create table if not exists public.rounds (
  id             uuid primary key default gen_random_uuid(),
  puzzle_id      uuid not null references public.puzzles(id) on delete cascade,
  position       int  not null check (position between 1 and 10),
  media_type     text not null default 'image' check (media_type in ('image', 'video')),
  category       text not null,
  subject        text not null,          -- short human description, shown after answering
  source_query   text,                   -- subject-bank query, used to avoid repeats
  a_url          text not null,
  b_url          text not null,
  real_side      char(1) not null check (real_side in ('A', 'B')),
  tell           text,                   -- what gives the AI one away
  real_credit    text,                   -- photographer credit for the real one
  real_source_id text,                   -- e.g. pexels:12345, to avoid reusing photos
  ai_prompt      text,
  ai_model       text,
  created_at     timestamptz not null default now(),
  unique (puzzle_id, position)
);

create table if not exists public.answers (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  round_id   uuid not null references public.rounds(id) on delete cascade,
  picked     char(1) not null check (picked in ('A', 'B')),
  correct    boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, round_id)
);
create index if not exists answers_round_idx   on public.answers(round_id);
create index if not exists answers_created_idx on public.answers(created_at);

create table if not exists public.friendships (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ---------------------------------------------------------------------
-- Row level security
-- Puzzles/rounds are never readable directly (that would leak real_side).
-- Everything goes through the security-definer functions below.
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.puzzles     enable row level security;
alter table public.rounds      enable row level security;
alter table public.answers     enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "read own profile"   on public.profiles;
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "read own answers"   on public.answers;
drop policy if exists "read own friends"   on public.friendships;

create policy "read own profile"   on public.profiles    for select using (id = auth.uid());
create policy "update own profile" on public.profiles    for update using (id = auth.uid()) with check (id = auth.uid());
create policy "read own answers"   on public.answers     for select using (user_id = auth.uid());
create policy "read own friends"   on public.friendships for select using (user_id = auth.uid());

revoke update on public.profiles from anon, authenticated;
grant  update (display_name, handle, phone_e164) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- New users get a profile with an embarrassing default name
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  adj  text[] := array['Gullible','Trusting','Wide-Eyed','Credulous','Hopeful','Naive',
                       'Bamboozled','Hoodwinked','Starry-Eyed','Unbothered','Clueless','Easily Led'];
  noun text[] := array['Walrus','Pigeon','Llama','Toaster','Goldfish','Possum','Raccoon',
                       'Moose','Penguin','Capybara','Houseplant','Uncle'];
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    adj[1 + floor(random() * array_length(adj, 1))::int] || ' ' ||
    noun[1 + floor(random() * array_length(noun, 1))::int] || ' ' ||
    (100 + floor(random() * 900))::int
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Internal aggregate (not exposed to clients)
-- ---------------------------------------------------------------------
create or replace view public.player_totals as
select p.id as user_id,
       p.display_name,
       p.handle,
       count(a.round_id)::int                              as rounds,
       count(a.round_id) filter (where not a.correct)::int as fooled
from public.profiles p
left join public.answers a on a.user_id = p.id
group by p.id;

revoke all on public.player_totals from anon, authenticated;

-- ---------------------------------------------------------------------
-- Playing
-- ---------------------------------------------------------------------

-- A published puzzle for a date (today or earlier). real_side is only
-- included for rounds the caller has already answered.
create or replace function public.get_puzzle(p_date date) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', p.id,
    'date', p.puzzle_date,
    'rounds', coalesce((
      select json_agg(json_build_object(
        'id', r.id,
        'position', r.position,
        'media_type', r.media_type,
        'category', r.category,
        'a_url', r.a_url,
        'b_url', r.b_url,
        'result', case when a.round_id is null then null else json_build_object(
          'picked', a.picked, 'correct', a.correct, 'real_side', r.real_side,
          'tell', r.tell, 'subject', r.subject, 'real_credit', r.real_credit)
        end
      ) order by r.position)
      from public.rounds r
      left join public.answers a on a.round_id = r.id and a.user_id = auth.uid()
      where r.puzzle_id = p.id
    ), '[]'::json)
  )
  from public.puzzles p
  where p.puzzle_date = p_date
    and p.status = 'published'
    and p.puzzle_date <= public.app_today();
$$;

-- Lock in a pick. Answering twice returns the first answer.
create or replace function public.submit_answer(p_round uuid, p_pick text) returns json
language plpgsql security definer set search_path = public as $$
declare
  r         public.rounds%rowtype;
  v_pick    text := upper(p_pick);
  v_correct boolean;
  v_prev    public.answers%rowtype;
  v_ff      int;
  v_ft      int;
  v_pct     int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if v_pick not in ('A', 'B') then raise exception 'Pick A or B'; end if;

  select r2.* into r
  from public.rounds r2 join public.puzzles p on p.id = r2.puzzle_id
  where r2.id = p_round and p.status = 'published' and p.puzzle_date <= public.app_today();
  if not found then raise exception 'That round is not available'; end if;

  select * into v_prev from public.answers where user_id = auth.uid() and round_id = p_round;
  if found then
    v_pick := v_prev.picked;
    v_correct := v_prev.correct;
  else
    v_correct := (v_pick = r.real_side);
    insert into public.answers (user_id, round_id, picked, correct)
    values (auth.uid(), p_round, v_pick, v_correct);
  end if;

  select count(*) filter (where not a.correct), count(*)
    into v_ff, v_ft
  from public.answers a
  join public.friendships f on f.friend_id = a.user_id and f.user_id = auth.uid()
  where a.round_id = p_round;

  select round(100.0 * count(*) filter (where not correct) / nullif(count(*), 0))
    into v_pct
  from public.answers where round_id = p_round;

  return json_build_object(
    'picked', v_pick, 'correct', v_correct, 'real_side', r.real_side,
    'tell', r.tell, 'subject', r.subject, 'real_credit', r.real_credit,
    'friends_fooled', v_ff, 'friends_total', v_ft, 'global_fool_pct', coalesce(v_pct, 0));
end $$;

-- Per-day progress for the archive calendar.
create or replace function public.my_calendar(p_from date, p_to date)
returns table (puzzle_date date, total int, answered int, fooled int)
language sql stable security definer set search_path = public as $$
  select p.puzzle_date,
         count(r.id)::int,
         count(a.round_id)::int,
         count(a.round_id) filter (where not a.correct)::int
  from public.puzzles p
  join public.rounds r on r.puzzle_id = p.id
  left join public.answers a on a.round_id = r.id and a.user_id = auth.uid()
  where p.status = 'published'
    and p.puzzle_date between p_from and least(p_to, public.app_today())
  group by p.puzzle_date
  order by 1;
$$;

-- ---------------------------------------------------------------------
-- Leaderboards. p_board: 'friends' | 'global' | 'worst'
-- Returns the top p_limit plus the caller's own row.
-- ---------------------------------------------------------------------
create or replace function public.leaderboard(p_board text, p_limit int default 25)
returns table (rank bigint, user_id uuid, display_name text, handle text,
               rounds int, fooled int, points int, pct int, is_me boolean)
language sql stable security definer set search_path = public as $$
  with base as (
    select t.*
    from public.player_totals t
    where (t.rounds > 0 or p_board = 'friends')
      and (p_board <> 'worst' or t.rounds >= 20)
      and (p_board <> 'friends'
           or t.user_id = auth.uid()
           or t.user_id in (select f.friend_id from public.friendships f where f.user_id = auth.uid()))
  ),
  ranked as (
    select b.*,
           case when p_board = 'worst'
                then rank() over (order by (b.fooled::numeric / nullif(b.rounds, 0)) desc, b.rounds desc)
                else rank() over (order by b.fooled desc, b.rounds asc)
           end as rnk
    from base b
  )
  select k.rnk, k.user_id, k.display_name, k.handle, k.rounds, k.fooled,
         -100 * k.fooled,
         coalesce(round(100.0 * k.fooled / nullif(k.rounds, 0)), 0)::int,
         k.user_id = auth.uid()
  from ranked k
  where k.rnk <= p_limit or k.user_id = auth.uid()
  order by k.rnk, k.display_name;
$$;

-- Wall of Shame: last 7 days, with each person's most embarrassing miss
-- (the round they got wrong that the fewest other people got wrong).
create or replace function public.wall_of_shame(p_limit int default 10)
returns table (rank bigint, user_id uuid, display_name text, points int,
               fooled int, rounds int, worst_miss text, is_me boolean)
language sql stable security definer set search_path = public as $$
  with week as (
    select a.* from public.answers a where a.created_at >= now() - interval '7 days'
  ),
  totals as (
    select w.user_id, count(*)::int as rounds, count(*) filter (where not w.correct)::int as fooled
    from week w group by w.user_id
  ),
  round_rates as (
    select a.round_id, avg(case when a.correct then 0 else 1 end) as fool_rate
    from public.answers a group by a.round_id
  ),
  misses as (
    select distinct on (w.user_id) w.user_id, r.subject
    from week w
    join public.rounds r on r.id = w.round_id
    join round_rates rr on rr.round_id = w.round_id
    where not w.correct
    order by w.user_id, rr.fool_rate asc, w.created_at desc
  ),
  ranked as (
    select t.*, rank() over (order by t.fooled desc, t.rounds asc) as rnk
    from totals t where t.fooled > 0
  )
  select k.rnk, k.user_id, p.display_name, -100 * k.fooled, k.fooled, k.rounds,
         m.subject, k.user_id = auth.uid()
  from ranked k
  join public.profiles p on p.id = k.user_id
  left join misses m on m.user_id = k.user_id
  where k.rnk <= p_limit or k.user_id = auth.uid()
  order by k.rnk;
$$;

-- Everything the home and profile screens need about the caller.
create or replace function public.my_summary() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid       uuid := auth.uid();
  v_today   date := public.app_today();
  v_rounds  int;
  v_fooled  int;
  v_streak  int := 0;
  v_longest int := 0;
  v_worst_day int := 0;
  v_yday    json;
  v_unplayed int;
  v_cats    json;
  v_rg bigint; v_rf bigint; v_rw bigint;
begin
  if uid is null then return null; end if;

  select rounds, fooled into v_rounds, v_fooled from public.player_totals where user_id = uid;

  with per_day as (
    select p.puzzle_date as d,
           count(*) filter (where not a.correct) as fooled
    from public.answers a
    join public.rounds r on r.id = a.round_id
    join public.puzzles p on p.id = r.puzzle_id
    where a.user_id = uid
    group by p.puzzle_date
  ),
  shame_days as (
    select d, d - (row_number() over (order by d))::int as grp from per_day where fooled > 0
  ),
  islands as (
    select count(*)::int as len, max(d) as last_day from shame_days group by grp
  )
  select coalesce(max(len) filter (where last_day >= v_today - 1), 0),
         coalesce(max(len), 0)
    into v_streak, v_longest
  from islands;

  select coalesce(max(c), 0) into v_worst_day from (
    select count(*) filter (where not a.correct) as c
    from public.answers a join public.rounds r on r.id = a.round_id
    where a.user_id = uid group by r.puzzle_id
  ) x;

  select json_build_object('answered', count(a.round_id), 'fooled', count(a.round_id) filter (where not a.correct), 'total', count(r.id))
    into v_yday
  from public.puzzles p
  join public.rounds r on r.puzzle_id = p.id
  left join public.answers a on a.round_id = r.id and a.user_id = uid
  where p.puzzle_date = v_today - 1 and p.status = 'published';

  select count(*) into v_unplayed from (
    select p.id
    from public.puzzles p
    join public.rounds r on r.puzzle_id = p.id
    left join public.answers a on a.round_id = r.id and a.user_id = uid
    where p.status = 'published' and p.puzzle_date < v_today
    group by p.id
    having count(a.round_id) < count(r.id)
  ) x;

  select coalesce(json_agg(json_build_object('category', category, 'total', total, 'fooled', fooled)
                           order by (fooled::numeric / total) desc, total desc), '[]'::json)
    into v_cats
  from (
    select r.category, count(*)::int as total, count(*) filter (where not a.correct)::int as fooled
    from public.answers a join public.rounds r on r.id = a.round_id
    where a.user_id = uid group by r.category
  ) c;

  select l.rank into v_rg from public.leaderboard('global', 0)  l where l.is_me;
  select l.rank into v_rf from public.leaderboard('friends', 0) l where l.is_me;
  select l.rank into v_rw from public.leaderboard('worst', 0)   l where l.is_me;

  return json_build_object(
    'rounds', coalesce(v_rounds, 0),
    'fooled', coalesce(v_fooled, 0),
    'points', -100 * coalesce(v_fooled, 0),
    'shame_streak', v_streak,
    'longest_streak', v_longest,
    'worst_day', v_worst_day,
    'yesterday', v_yday,
    'unplayed_days', v_unplayed,
    'categories', v_cats,
    'rank_global', v_rg,
    'rank_friends', v_rf,
    'rank_worst', v_rw
  );
end $$;

-- ---------------------------------------------------------------------
-- Friends
-- ---------------------------------------------------------------------
create or replace function public.invite_info(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('user_id', id, 'display_name', display_name)
  from public.profiles where invite_code = lower(p_code);
$$;

create or replace function public.add_friend_by_code(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare v_friend public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into v_friend from public.profiles where invite_code = lower(p_code);
  if not found then raise exception 'That invite link is not valid'; end if;
  if v_friend.id = auth.uid() then raise exception 'That is your own invite link'; end if;
  insert into public.friendships (user_id, friend_id) values (auth.uid(), v_friend.id), (v_friend.id, auth.uid())
  on conflict do nothing;
  return json_build_object('user_id', v_friend.id, 'display_name', v_friend.display_name);
end $$;

create or replace function public.add_friend_by_phone(p_phone text) returns json
language plpgsql security definer set search_path = public as $$
declare v_friend public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into v_friend from public.profiles where phone_e164 = p_phone;
  if not found then return null; end if;
  if v_friend.id = auth.uid() then raise exception 'That is your own number'; end if;
  insert into public.friendships (user_id, friend_id) values (auth.uid(), v_friend.id), (v_friend.id, auth.uid())
  on conflict do nothing;
  return json_build_object('user_id', v_friend.id, 'display_name', v_friend.display_name);
end $$;

create or replace function public.remove_friend(p_friend uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friendships
  where (user_id = auth.uid() and friend_id = p_friend)
     or (user_id = p_friend and friend_id = auth.uid());
$$;

-- Friends with lifetime totals and how today is going for them.
create or replace function public.my_friends()
returns table (user_id uuid, display_name text, handle text, points int, rounds int,
               today_answered int, today_fooled int)
language sql stable security definer set search_path = public as $$
  select t.user_id, t.display_name, t.handle, -100 * t.fooled, t.rounds,
         coalesce(td.answered, 0), coalesce(td.fooled, 0)
  from public.friendships f
  join public.player_totals t on t.user_id = f.friend_id
  left join lateral (
    select count(*)::int as answered, count(*) filter (where not a.correct)::int as fooled
    from public.answers a
    join public.rounds r on r.id = a.round_id
    join public.puzzles p on p.id = r.puzzle_id
    where a.user_id = f.friend_id and p.puzzle_date = public.app_today()
  ) td on true
  where f.user_id = auth.uid()
  order by coalesce(td.fooled, 0) desc, t.fooled desc;
$$;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.handle_new_user()             to supabase_auth_admin;
grant execute on function public.app_today()                    to anon, authenticated;
grant execute on function public.get_puzzle(date)               to anon, authenticated;
grant execute on function public.submit_answer(uuid, text)      to authenticated;
grant execute on function public.my_calendar(date, date)        to anon, authenticated;
grant execute on function public.leaderboard(text, int)         to anon, authenticated;
grant execute on function public.wall_of_shame(int)             to anon, authenticated;
grant execute on function public.my_summary()                   to anon, authenticated;
grant execute on function public.invite_info(text)              to anon, authenticated;
grant execute on function public.add_friend_by_code(text)       to authenticated;
grant execute on function public.add_friend_by_phone(text)      to authenticated;
grant execute on function public.remove_friend(uuid)            to authenticated;
grant execute on function public.my_friends()                   to anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage for puzzle media. Public read by URL; file names are random
-- so a URL never reveals which side is real. No listing policy exists.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
