-- Ejecuta este archivo en el SQL Editor de Supabase antes de usar la app Angular.
-- No requiere ni expone la secret key en el navegador.

create table if not exists public.editorial_brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null,
  palette jsonb not null default '["#F4BE2A", "#201914", "#F7F1E3"]'::jsonb,
  status text not null default 'review' check (status in ('draft', 'review', 'approved')),
  created_at timestamptz not null default now()
);

create table if not exists public.editorial_posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.editorial_brands(id) on delete cascade,
  topic text not null,
  channel text not null check (channel in ('instagram_portrait', 'instagram_square', 'tiktok_vertical')),
  status text not null default 'review' check (status in ('draft', 'review', 'approved')),
  hook text not null,
  caption text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.editorial_assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.editorial_brands(id) on delete cascade,
  name text not null,
  kind text not null,
  image_url text not null,
  tags jsonb not null default '[]'::jsonb,
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.editorial_slides (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.editorial_posts(id) on delete cascade,
  slide_order integer not null,
  headline text not null,
  body text not null,
  composition text not null,
  image_url text,
  created_at timestamptz not null default now(),
  unique(post_id, slide_order)
);

alter table public.editorial_brands enable row level security;
alter table public.editorial_posts enable row level security;
alter table public.editorial_assets enable row level security;
alter table public.editorial_slides enable row level security;

create policy "users manage own editorial brands" on public.editorial_brands for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own editorial posts" on public.editorial_posts for all using (exists (select 1 from public.editorial_brands b where b.id = brand_id and b.user_id = auth.uid())) with check (exists (select 1 from public.editorial_brands b where b.id = brand_id and b.user_id = auth.uid()));
create policy "users manage own editorial assets" on public.editorial_assets for all using (exists (select 1 from public.editorial_brands b where b.id = brand_id and b.user_id = auth.uid())) with check (exists (select 1 from public.editorial_brands b where b.id = brand_id and b.user_id = auth.uid()));
create policy "users manage own editorial slides" on public.editorial_slides for all using (exists (select 1 from public.editorial_posts p join public.editorial_brands b on b.id = p.brand_id where p.id = post_id and b.user_id = auth.uid())) with check (exists (select 1 from public.editorial_posts p join public.editorial_brands b on b.id = p.brand_id where p.id = post_id and b.user_id = auth.uid()));
