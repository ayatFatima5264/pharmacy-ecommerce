/**
 * Cities the cart can quote delivery for.
 *
 * A plain constant so it is importable from Client Components — deriving it
 * from the shipping zones requires `server-only` data, which the cart page
 * cannot import. Keep in sync with adminShippingZones.
 */
export const CART_CITIES = [
  'Abbottabad',
  'Faisalabad',
  'Gujranwala',
  'Hyderabad',
  'Islamabad',
  'Karachi',
  'Lahore',
  'Larkana',
  'Multan',
  'Peshawar',
  'Quetta',
  'Rawalpindi',
  'Sialkot',
  'Sukkur',
] as const
