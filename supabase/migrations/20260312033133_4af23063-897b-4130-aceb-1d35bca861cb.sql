
CREATE OR REPLACE FUNCTION public.remove_device(p_device_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owns BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.devices d
    JOIN public.playlists p ON p.id = d.playlist_id
    WHERE d.id = p_device_id AND p.user_id = auth.uid()
  ) INTO v_owns;

  IF NOT v_owns THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  DELETE FROM public.devices WHERE id = p_device_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;
