-- Fix missing profiles.goal_mode column
-- Safe to run multiple times.

alter table public.profiles
  add column if not exists goal_mode text not null default 'maintain';

alter table public.profiles
  drop constraint if exists profiles_goal_mode_check;

alter table public.profiles
  add constraint profiles_goal_mode_check check (goal_mode in ('cut','maintain','bulk'));
