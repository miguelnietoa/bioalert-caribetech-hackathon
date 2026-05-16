SELECT
  i.nombre_producto,
  i.current_stock,
  i.minimum_stock,
  ca.phone_e164,
  ca.display_name
FROM bioalert.inventory i
JOIN bioalert.cafeteria_admins ca ON ca.nit_colegio = i.nit_colegio
WHERE i.current_stock <= i.minimum_stock
ORDER BY ca.phone_e164, i.current_stock ASC;
