import { condition } from './weather';

export default function WeatherIcon({
  code,
  day = true,
  size = 32,
  className = '',
}: {
  code: number | null;
  day?: boolean;
  size?: number;
  className?: string;
}) {
  const { sky, label } = condition(code, day);
  const cloud = (
    <path
      d="M17 40a9 9 0 0 1-.8-18A14 14 0 0 1 43 20a10 10 0 1 1 3 20Z"
      fill="var(--cloud-fill, #e7eaf0)"
      stroke="var(--cloud-stroke, #a3adba)"
      strokeWidth="2.3"
    />
  );
  const sun = (
    <g stroke="#eaa04b" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="30" cy="28" r="11" fill="#f6bd63" stroke="none" />
      <path d="M30 8v-3m0 43v3M10 28H7m43 0h3M16 14l-2-2m30 30 2 2M16 42l-2 2m30-30 2-2" />
    </g>
  );
  const moon = (
    <path
      d="M39 10a20 20 0 1 0 14 30A21 21 0 0 1 39 10Z"
      fill="#becbea"
      stroke="#a0b4d9"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  );
  return (
    <svg
      className={`weather-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={label}
    >
      {sky === 'sun' && sun}
      {sky === 'moon' && moon}
      {sky === 'partly' && (
        <>
          <g transform="translate(8 -3) scale(.8)">{day ? sun : moon}</g>
          <g transform="translate(0 8)">{cloud}</g>
        </>
      )}
      {sky === 'cloud' && (
        <>
          <g opacity=".5" transform="translate(10 -6) scale(.85)">
            {cloud}
          </g>
          <g transform="translate(-2 7)">{cloud}</g>
        </>
      )}
      {['rain', 'snow', 'storm', 'fog'].includes(sky) && <g transform="translate(0 -3)">{cloud}</g>}
      {sky === 'rain' && (
        <path
          d="m21 44-3 6m15-6-3 6m15-6-3 6"
          stroke="#769ece"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
      {sky === 'snow' && (
        <g fill="#9aafc7">
          <circle cx="20" cy="48" r="2.5" />
          <circle cx="32" cy="53" r="2.5" />
          <circle cx="44" cy="48" r="2.5" />
        </g>
      )}
      {sky === 'storm' && <path d="m33 35-9 13h8l-3 12 14-18h-9l5-7Z" fill="#e9a34b" />}
      {sky === 'fog' && (
        <path d="M13 45h38M19 52h26" stroke="#a3adba" strokeWidth="3" strokeLinecap="round" />
      )}
      {sky === 'unknown' && (
        <>
          <circle cx="32" cy="30" r="17" fill="none" stroke="#a3adba" strokeWidth="2" />
          <path d="M24 30h16" stroke="#a3adba" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}
