const CONFETTI_CLASS = "confetti-bit";

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function confettiBurst(x: number, y: number) {
  const colors = [
    "var(--accent)",
    "var(--good)",
    "var(--warn)",
    "var(--bad)",
    "var(--fg)"
  ];
  const count = 18;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("i");
    el.className = CONFETTI_CLASS;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.background = colors[i % colors.length]!;
    document.body.appendChild(el);

    const angle = rand(0, Math.PI * 2);
    const distance = rand(60, 130);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const rot = rand(-220, 220);
    const duration = rand(520, 920);

    const anim = el.animate(
      [
        { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg) scale(0.9)`,
          opacity: 0
        }
      ],
      {
        duration,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "forwards"
      }
    );

    anim.finished.finally(() => el.remove());
  }
}

