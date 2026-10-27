import { testimonials } from "../lib/testimonials";

export function TestimonialsSection() {
  if (!testimonials.length) return null;
  return (
    <section className="lp-section testimonials">
      <div className="lp-head" data-reveal><span className="lp-kicker">Kunden</span><h2>Was Transportunternehmen sagen</h2></div>
      {testimonials.some((item) => item.logo) ? <div className="testimonial-logos" data-reveal>{testimonials.filter((item) => item.logo).map((item) => <img key={item.company} src={item.logo} alt={item.company} />)}</div> : null}
      <div className="testimonial-grid">
        {testimonials.map((item, index) => (
          <figure key={item.name} data-reveal style={{ transitionDelay: `${index * 80}ms` }}>
            <blockquote>„{item.quote}“</blockquote>
            <figcaption>{item.photo ? <img src={item.photo} alt="" /> : <span>{item.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>}<div><b>{item.name}</b><small>{item.role} · {item.company}</small></div></figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
