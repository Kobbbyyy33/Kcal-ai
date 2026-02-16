-- KCAL AI - Supabase schema + RLS
-- Exécuter dans Supabase SQL Editor.

-- Extensions
create extension if not exists "uuid-ossp";

-- Tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  daily_calorie_goal integer not null default 2000,
  daily_protein_goal integer not null default 150,
  daily_carbs_goal integer not null default 250,
  daily_fat_goal integer not null default 65,
  theme text not null default 'light',
  budget_per_day numeric not null default 12,
  dietary_preferences text[] not null default '{}',
  allergens text[] not null default '{}',
  goal_mode text not null default 'maintain'
);

alter table public.profiles
  add column if not exists budget_per_day numeric not null default 12,
  add column if not exists dietary_preferences text[] not null default '{}',
  add column if not exists allergens text[] not null default '{}',
  add column if not exists goal_mode text not null default 'maintain';

alter table public.profiles
  drop constraint if exists profiles_goal_mode_check;
alter table public.profiles
  add constraint profiles_goal_mode_check check (goal_mode in ('cut','maintain','bulk'));

create table if not exists public.meals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  meal_type text not null,
  meal_name text,
  created_at timestamptz not null default now(),
  constraint meal_type_check check (meal_type in ('breakfast','lunch','dinner','snack'))
);

create index if not exists meals_user_date_idx on public.meals(user_id, date);

create table if not exists public.food_items (
  id uuid primary key default uuid_generate_v4(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  name text not null,
  quantity text,
  calories numeric not null,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  barcode text,
  image_url text,
  source text not null,
  constraint food_source_check check (source in ('ai','barcode','manual'))
);

create index if not exists food_items_meal_idx on public.food_items(meal_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

create table if not exists public.body_progress (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric,
  waist_cm numeric,
  chest_cm numeric,
  hips_cm numeric,
  photo_url text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists body_progress_user_date_idx on public.body_progress(user_id, date);

-- RLS
alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.food_items enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.body_progress enable row level security;

-- Drop policies first to make this script re-runnable safely
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

drop policy if exists "meals_select_own" on public.meals;
drop policy if exists "meals_insert_own" on public.meals;
drop policy if exists "meals_update_own" on public.meals;
drop policy if exists "meals_delete_own" on public.meals;

drop policy if exists "food_select_own" on public.food_items;
drop policy if exists "food_insert_own" on public.food_items;
drop policy if exists "food_update_own" on public.food_items;
drop policy if exists "food_delete_own" on public.food_items;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
drop policy if exists "body_progress_select_own" on public.body_progress;
drop policy if exists "body_progress_insert_own" on public.body_progress;
drop policy if exists "body_progress_update_own" on public.body_progress;
drop policy if exists "body_progress_delete_own" on public.body_progress;

drop policy if exists "meal_images_read_public" on storage.objects;
drop policy if exists "meal_images_insert_own_folder" on storage.objects;
drop policy if exists "meal_images_update_own_folder" on storage.objects;
drop policy if exists "meal_images_delete_own_folder" on storage.objects;

-- Profiles policies
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Meals policies
create policy "meals_select_own"
on public.meals
for select
using (auth.uid() = user_id);

create policy "meals_insert_own"
on public.meals
for insert
with check (auth.uid() = user_id);

create policy "meals_update_own"
on public.meals
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "meals_delete_own"
on public.meals
for delete
using (auth.uid() = user_id);

-- Food items policies (via parent meal ownership)
create policy "food_select_own"
on public.food_items
for select
using (
  exists (
    select 1
    from public.meals m
    where m.id = food_items.meal_id
      and m.user_id = auth.uid()
  )
);

create policy "food_insert_own"
on public.food_items
for insert
with check (
  exists (
    select 1
    from public.meals m
    where m.id = food_items.meal_id
      and m.user_id = auth.uid()
  )
);

create policy "food_update_own"
on public.food_items
for update
using (
  exists (
    select 1
    from public.meals m
    where m.id = food_items.meal_id
      and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.meals m
    where m.id = food_items.meal_id
      and m.user_id = auth.uid()
  )
);

create policy "food_delete_own"
on public.food_items
for delete
using (
  exists (
    select 1
    from public.meals m
    where m.id = food_items.meal_id
      and m.user_id = auth.uid()
  )
);

create policy "push_subscriptions_select_own"
on public.push_subscriptions
for select
using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
on public.push_subscriptions
for insert
with check (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
on public.push_subscriptions
for delete
using (auth.uid() = user_id);

create policy "body_progress_select_own"
on public.body_progress
for select
using (auth.uid() = user_id);

create policy "body_progress_insert_own"
on public.body_progress
for insert
with check (auth.uid() = user_id);

create policy "body_progress_update_own"
on public.body_progress
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "body_progress_delete_own"
on public.body_progress
for delete
using (auth.uid() = user_id);

-- Storage (bucket "meal-images")
-- 1) Create bucket in Supabase UI: Storage -> New bucket -> name: meal-images
-- 2) Public bucket: ON (lecture publique)
-- 3) RLS policies for storage.objects
-- Note: bucket_id = 'meal-images'

-- storage.objects already has RLS managed by Supabase storage internals.
-- Do not force ALTER here; it can fail with "must be owner of table objects".

create policy "meal_images_read_public"
on storage.objects
for select
using (bucket_id = 'meal-images');

create policy "meal_images_insert_own_folder"
on storage.objects
for insert
with check (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "meal_images_update_own_folder"
on storage.objects
for update
using (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "meal_images_delete_own_folder"
on storage.objects
for delete
using (
  bucket_id = 'meal-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
