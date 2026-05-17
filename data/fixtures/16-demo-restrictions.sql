-- Vacía bioalert.restrictions para que el demo arranque limpio:
-- la restricción que ve el POS mock se crea EN VIVO durante el demo,
-- cuando Diana toca "Restringir" en WhatsApp y el bot llama a
-- activate_restriction. Es el "wow" del flow.
--
-- Si quieres pre-cargar restricciones para probar el POS sin pasar por
-- el bot, agrega INSERTs aquí y vuelve a correr `npm run fixtures:apply`.
TRUNCATE bioalert.restrictions;
