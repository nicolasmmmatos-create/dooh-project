
-- Change videos foreign key from CASCADE to SET NULL so deleting a playlist keeps the media in the library
ALTER TABLE public.videos DROP CONSTRAINT videos_playlist_id_fkey;
ALTER TABLE public.videos ADD CONSTRAINT videos_playlist_id_fkey 
  FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE SET NULL;
