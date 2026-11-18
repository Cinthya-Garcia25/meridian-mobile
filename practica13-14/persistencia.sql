-- Se ejecuta en una base desechable con el esquema de laboratorio.
BEGIN;

INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.profiles(id) VALUES ('00000000-0000-0000-0000-000000000001');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims =
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"ana@example.com"}';

DO $$
DECLARE
  solicitud constant uuid := '00000000-0000-0000-0000-000000000042';
  datos jsonb := jsonb_build_object(
    'destino', 'Cancún', 'origen', 'Querétaro', 'nombre', 'Ana',
    'correo', 'ana@example.com', 'telefono', '4421234567',
    'salida', (now() AT TIME ZONE 'America/Mexico_City')::date + 7,
    'acompanantes', jsonb_build_array(jsonb_build_object('nombre', 'Luis', 'edad', 12))
  );
  primero text;
  segundo text;
  fila public.cotizacion_leads%ROWTYPE;
BEGIN
  primero := public.movil_crear_cotizacion(datos, solicitud);
  segundo := public.movil_crear_cotizacion(datos, solicitud);

  IF primero IS NULL OR primero IS DISTINCT FROM segundo THEN
    RAISE EXCEPTION 'El mismo UUID debe devolver el mismo identificador';
  END IF;

  RESET ROLE;
  SELECT * INTO STRICT fila FROM public.cotizacion_leads WHERE solicitud_movil_id = solicitud;
  IF fila.id::text IS DISTINCT FROM primero
     OR fila.usuario_movil_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001'::uuid
     OR fila.destino IS DISTINCT FROM 'Cancún'
     OR fila.origen_ciudad IS DISTINCT FROM 'Querétaro'
     OR fila.adultos IS DISTINCT FROM 1
     OR fila.ninos IS DISTINCT FROM 1
     OR fila.acompanantes IS DISTINCT FROM datos->'acompanantes' THEN
    RAISE EXCEPTION 'La cotización no se persistió con los valores esperados';
  END IF;
  RAISE NOTICE 'AUT-06 aprobado. El reenvío reutilizó el identificador y quedó exactamente una cotización.';
END;
$$;

ROLLBACK;
