# Prácticas 13 y 14. Automatización de pruebas de Meridian Mobile

**Fecha de validación** · 17 de noviembre de 2026

## Componentes y riesgo

La función seleccionada fue el envío de una solicitud de cotización desde `ReservaComponent`. `ViajesService` comunica la aplicación con Supabase mediante la RPC `movil_crear_cotizacion`. La función SQL persiste los datos en `cotizacion_leads` y usa el UUID de la solicitud para reconocer reenvíos del mismo usuario.

En la práctica 12, el escenario RES-07 identificó el riesgo de duplicar una cotización si el servidor guarda la solicitud y se pierde la respuesta. En ese caso, la interfaz debe mostrar un resultado incierto y conservar los datos y el UUID al reenviar. PostgreSQL debe devolver el identificador original y mantener una sola fila.

## Pruebas y resultados

Meridian Mobile usa Angular y Cordova para Android. Las pruebas del cliente usan Vitest y Angular TestBed. Se añadieron siete pruebas unitarias para datos válidos, destino vacío o en blanco, fechas fuera de rango, regreso opcional, recuperación tras una excepción y propagación del error cuando se agotan los intentos.

Las tres pruebas de integración ejecutan el componente y el servicio reales. El doble de transporte permite entregar HTTP 200, HTTP 401 y errores de red de manera controlada. Se comprueban los argumentos de la RPC, la confirmación o el error que expone el componente y la conservación del UUID y el contenido durante el reenvío. Por separado, PostgreSQL 16 ejecuta las migraciones reales sobre un esquema mínimo desechable. La prueba invoca dos veces la función con el mismo UUID y verifica el identificador, la unicidad y el contenido de la fila, incluidos los acompañantes.

El 17 de noviembre, la suite local aprobó **82 de 82** pruebas en 12 archivos, con **0 fallos**, en **1.986 s** medidos desde el comando de ejecución. La prueba de persistencia aprobó en **0.026 s**. El total de ambos comandos fue **2.012 s**, sin contar la instalación de dependencias ni el arranque de PostgreSQL. Una instalación limpia desde el lockfile también aprobó las 82 pruebas. [Registro local](ejecucion-local.log).

## Errores y cambios

La lógica de validación de fechas y campos se extrajo del componente para verificarla de forma aislada. La suite de referencia ya aprobaba sus 72 pruebas y la ampliación no encontró defectos nuevos en la aplicación. El rechazo inicial de PostgreSQL se debió a que el entorno restringido impedía reservar memoria compartida. La ejecución se repitió con permiso para iniciar una instancia temporal y la prueba aprobó. La pérdida de red y el HTTP 401 fueron fallos provocados para comprobar el manejo de errores.

## Validación continua

GitHub Actions ejecuta la suite y la comprobación SQL en cada push y pull request. El flujo instala las dependencias fijadas en el lockfile y levanta PostgreSQL 16 como servicio temporal. Un error de prueba devuelve un código distinto de cero y hace fallar el trabajo. [Historial de GitHub Actions de la rama](https://github.com/Cinthya-Garcia25/meridian-mobile/actions/workflows/pruebas-moviles.yml?query=branch%3Acodex%2Fpracticas-13-14).

La primera ejecución, activada al publicar el flujo, aprobó la suite Angular y la comprobación PostgreSQL. El trabajo duró **34 s**, incluida la preparación del entorno. [Primera ejecución](https://github.com/Cinthya-Garcia25/meridian-mobile/actions/runs/44205532964).

El segundo push publicó el reporte y la matriz. GitHub Actions volvió a ejecutar ambos pasos y aprobó en **41 s**. [Segunda ejecución](https://github.com/Cinthya-Garcia25/meridian-mobile/actions/runs/44205734798).

## Conclusión técnica

La automatización permite comprobar después de cada cambio que una solicitud válida se confirma, que la aplicación distingue un rechazo de sesión de un resultado incierto y que el reenvío mantiene una sola cotización. Verificar el cliente y la persistencia en cada push permite detectar regresiones tanto en el contrato de la RPC como en el almacenamiento. Las respuestas del transporte se simulan y el esquema SQL es de laboratorio, por lo que las mediciones corresponden a ese alcance.
