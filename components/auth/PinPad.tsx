"use client";

export function PinPad({ value, onChange, onComplete, busy, label = "6자리 번호" }: {
  value: string; onChange: (value: string) => void; onComplete?: (value: string) => void; busy: boolean; label?: string;
}) {
  function update(next: string) {
    if (busy) return;
    const digits = next.replace(/[^0-9]/g, "").slice(0, 6);
    onChange(digits);
    if (digits.length === 6 && value.length < 6) onComplete?.(digits);
  }
  return <div className="pin-pad">
    <div className="pin-entry">
      <input aria-label={label} type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6}
        autoComplete="off" value={value} disabled={busy} onChange={event => update(event.target.value)} />
      <div className="pin-dots" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <i key={index} data-filled={index < value.length} />)}</div>
    </div>
    <div className="pin-keypad" role="group" aria-label="숫자 키패드">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(number => <button key={number} type="button" disabled={busy || value.length === 6} onClick={() => update(value + number)}>{number}</button>)}
      <span aria-hidden="true" />
      <button type="button" disabled={busy || value.length === 6} onClick={() => update(value + "0")}>0</button>
      <button type="button" aria-label="한 자리 지우기" disabled={busy || !value} onClick={() => update(value.slice(0, -1))}>⌫</button>
    </div>
  </div>;
}
