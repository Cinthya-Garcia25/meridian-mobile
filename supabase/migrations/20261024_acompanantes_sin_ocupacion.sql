BEGIN;
CREATE OR REPLACE FUNCTION public.movil_crear_cotizacion(p_datos jsonb,p_solicitud uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_usuario uuid:=auth.uid(); v_correo text:=auth.jwt()->>'email'; v_id bigint;
 v_acompanantes jsonb; v_persona jsonb; v_edad integer;
 v_adultos integer:=1; v_ninos integer:=0; v_salida date; v_regreso date;
BEGIN
 IF v_usuario IS NULL OR nullif(v_correo,'') IS NULL THEN RAISE EXCEPTION 'Inicia sesión para enviar la solicitud.' USING ERRCODE='28000'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=v_usuario AND activo=false) THEN RAISE EXCEPTION 'Tu cuenta está desactivada.' USING ERRCODE='42501'; END IF;
 IF p_solicitud IS NULL OR p_datos IS NULL OR jsonb_typeof(p_datos)<>'object' THEN RAISE EXCEPTION 'La solicitud no es válida.'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_usuario::text||p_solicitud::text,0));
 SELECT id INTO v_id FROM public.cotizacion_leads WHERE usuario_movil_id=v_usuario AND solicitud_movil_id=p_solicitud;
 IF FOUND THEN RETURN v_id::text; END IF;
 IF nullif(btrim(p_datos->>'destino'),'') IS NULL OR length(p_datos->>'destino')>120
 OR nullif(btrim(p_datos->>'origen'),'') IS NULL OR length(p_datos->>'origen')>120
 OR nullif(btrim(p_datos->>'nombre'),'') IS NULL OR length(p_datos->>'nombre')>100
 OR coalesce(p_datos->>'correo','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(p_datos->>'correo')>254
 OR coalesce(p_datos->>'telefono','')!~'^[+0-9 ()-]{10,20}$'
 OR length(coalesce(p_datos->>'comentarios',''))>1000 THEN RAISE EXCEPTION 'Revisa los datos de contacto y del viaje.'; END IF;
 v_salida:=nullif(p_datos->>'salida','')::date; v_regreso:=nullif(p_datos->>'regreso','')::date;
 IF v_salida IS NULL OR v_salida<(now() AT TIME ZONE 'America/Mexico_City')::date OR v_regreso<v_salida THEN RAISE EXCEPTION 'Revisa las fechas del viaje.'; END IF;
 v_acompanantes:=coalesce(p_datos->'acompanantes','[]'::jsonb);
 IF jsonb_typeof(v_acompanantes)<>'array' THEN RAISE EXCEPTION 'Acompañantes no válidos.'; END IF;
 IF jsonb_array_length(v_acompanantes)>40 THEN RAISE EXCEPTION 'Máximo 40 acompañantes por solicitud.'; END IF;
 FOR v_persona IN SELECT value FROM jsonb_array_elements(v_acompanantes) LOOP
 IF jsonb_typeof(v_persona)<>'object' OR nullif(btrim(v_persona->>'nombre'),'') IS NULL OR length(v_persona->>'nombre')>100
 OR length(coalesce(v_persona->>'profesion',''))>120
 OR coalesce(v_persona->>'edad','')!~'^[0-9]{1,3}$'
 OR length(coalesce(v_persona->>'correo',''))>254
 OR (coalesce(v_persona->>'correo','')<>'' AND (v_persona->>'correo')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'Revisa los datos de los acompañantes.'; END IF;
 v_edad:=(v_persona->>'edad')::integer;
 IF v_edad<1 OR v_edad>120 THEN RAISE EXCEPTION 'Edad de acompañante no válida.'; END IF;
 IF v_edad<18 THEN v_ninos:=v_ninos+1; ELSE v_adultos:=v_adultos+1; END IF;
 END LOOP;
 INSERT INTO public.cotizacion_leads(tipo_viaje,destino,fecha_ida,fecha_vuelta,adultos,ninos,nombre,correo,telefono,comentarios,usuario_movil_id,solicitud_movil_id,origen_ciudad,correo_contacto,acompanantes)
 VALUES('Viaje desde app móvil',btrim(p_datos->>'destino'),v_salida,v_regreso,v_adultos,v_ninos,btrim(p_datos->>'nombre'),lower(v_correo),btrim(p_datos->>'telefono'),nullif(btrim(p_datos->>'comentarios'),''),v_usuario,p_solicitud,btrim(p_datos->>'origen'),btrim(p_datos->>'correo'),v_acompanantes) RETURNING id INTO v_id;
 RETURN v_id::text;
END; $$;

COMMIT;
NOTIFY pgrst,'reload schema';
