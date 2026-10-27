// Customer quotes for the landing page. Only add real quotes with the customer's written permission;
// the section stays hidden while this list is empty.
export type Testimonial = { quote: string; name: string; role: string; company: string; logo?: string; photo?: string };

export const testimonials: Testimonial[] = [];
