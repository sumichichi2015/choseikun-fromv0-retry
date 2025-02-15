-- 会議テーブル
create table meetings (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  access_token text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 時間枠テーブル
create table time_slots (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references meetings(id) on delete cascade,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(meeting_id, start_time), -- 同じ会議で同じ開始時刻を持つ時間枠を防ぐ
  check(end_time > start_time) -- 終了時刻が開始時刻より後であることを保証
);

-- 参加者テーブル
create table participants (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references meetings(id) on delete cascade,
  name text not null,
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 回答テーブル
create table responses (
  id uuid default uuid_generate_v4() primary key,
  time_slot_id uuid references time_slots(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  availability smallint not null check (availability in (0, 1, 3)), -- 0: ×, 1: △, 3: ○
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(time_slot_id, participant_id)
);

-- RLSポリシーの設定
alter table meetings enable row level security;
alter table time_slots enable row level security;
alter table participants enable row level security;
alter table responses enable row level security;

-- 会議テーブルのポリシー
create policy "Anyone can create meetings"
  on meetings for insert
  to anon
  with check (true);

create policy "Anyone with access token can view meetings"
  on meetings for select
  to anon
  using (true);

-- 時間枠テーブルのポリシー
create policy "Anyone can view time slots"
  on time_slots for select
  to anon
  using (true);

create policy "Anyone can create time slots"
  on time_slots for insert
  to anon
  with check (true);

-- 参加者テーブルのポリシー
create policy "Anyone can create participants"
  on participants for insert
  to anon
  with check (true);

create policy "Anyone can view participants"
  on participants for select
  to anon
  using (true);

-- 回答テーブルのポリシー
create policy "Anyone can create responses"
  on responses for insert
  to anon
  with check (true);

create policy "Anyone can view responses"
  on responses for select
  to anon
  using (true);

create policy "Anyone can update their own responses"
  on responses for update
  to anon
  using (true)
  with check (true);
