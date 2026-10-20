import { useId } from "react";
export function Mascot({
  small = false,
  sleeping = false,
}: {
  small?: boolean;
  sleeping?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      className={small ? "mascot mini" : "mascot"}
      viewBox="0 0 320 300"
      role="img"
      aria-label={sleeping ? "小N安静地休息" : "原创学伴小N，绿色的小芽伙伴"}
    >
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0.8" y2="1">
          <stop stopColor="#e2edc9" />
          <stop offset=".52" stopColor="#bed49f" />
          <stop offset="1" stopColor="#83a871" />
        </linearGradient>
        <radialGradient id={`${uid}glow`}>
          <stop stopColor="#f6fae6" stopOpacity=".95" />
          <stop offset="1" stopColor="#e4efce" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}blur`}>
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <ellipse
        cx="157"
        cy="269"
        rx="88"
        ry="13"
        fill="#6b8c55"
        opacity=".14"
        filter={`url(#${uid}blur)`}
      />
      <g className={!small ? "floaty" : ""}>
        <path
          d="M149 70C124 39 137 19 146 17c4 23 20 22 20 51"
          fill="#587c4b"
        />
        <path
          d="M157 66C149 33 173 14 198 21c-6 29-20 44-41 45"
          fill="#88a86f"
        />
        <path d="M159 59l27-29" stroke="#b9cc9b" strokeWidth="2" />
        <path
          d="M91 117C69 144 67 175 49 182c-17 10-13 26 5 28 18 1 36-19 44-32"
          fill={`url(#${uid})`}
          stroke="#83a76e"
          strokeWidth="1.4"
        />
        <path
          d="M226 119c18 19 27 49 43 54 18 5 22 24 5 29-17 6-43-13-54-29"
          fill={`url(#${uid})`}
          stroke="#83a76e"
          strokeWidth="1.4"
        />
        <path
          d="M80 178C69 122 85 74 135 63c39-9 88 6 102 52 11 37-6 70-5 93 1 22-13 47-32 48-19 1-22-23-39-23-17 0-23 26-43 23-23-2-28-24-29-45Z"
          fill={`url(#${uid})`}
          stroke="#86a76f"
          strokeWidth="1.5"
        />
        <ellipse cx="137" cy="112" rx="65" ry="49" fill={`url(#${uid}glow)`} />
        <path
          d="M113 84c-17 8-25 22-25 37"
          fill="none"
          stroke="#f0f5df"
          strokeWidth="5"
          strokeLinecap="round"
          opacity=".8"
        />
        {sleeping ? (
          <>
            <path
              d="M118 142q9 7 18 0M177 142q9 7 18 0"
              stroke="#344d35"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
            <text x="248" y="97" fill="#7d9468" fontSize="25">
              z
            </text>
          </>
        ) : (
          <>
            <ellipse cx="127" cy="139" rx="5" ry="8" fill="#304932" />
            <ellipse cx="183" cy="139" rx="5" ry="8" fill="#304932" />
            <circle cx="129" cy="136" r="1.7" fill="white" />
            <circle cx="185" cy="136" r="1.7" fill="white" />
          </>
        )}
        <ellipse
          cx="109"
          cy="155"
          rx="12"
          ry="6"
          fill="#d9a88c"
          opacity=".58"
        />
        <ellipse
          cx="199"
          cy="155"
          rx="12"
          ry="6"
          fill="#d9a88c"
          opacity=".58"
        />
        <path
          d="M147 157q9 10 18 0"
          fill="none"
          stroke="#446043"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M141 197v-17l28 22v-18"
          stroke="#f4f8e5"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity=".8"
        />
        <path
          d="M97 219c7 13 14 17 23 15M201 234c10-3 17-9 20-19"
          stroke="#74965e"
          strokeWidth="2"
          fill="none"
          opacity=".6"
        />
      </g>
    </svg>
  );
}
export function HeroArt({ sleeping = false }: { sleeping?: boolean }) {
  return (
    <div className="hero-art">
      <svg className="landscape" viewBox="0 0 440 310" aria-hidden="true">
        <defs>
          <radialGradient id="sky">
            <stop stopColor="#edf0d4" />
            <stop offset="1" stopColor="#f7f6ec" />
          </radialGradient>
          <pattern
            id="grid"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M22 0H0v22"
              fill="none"
              stroke="#b5bd9d"
              strokeWidth=".5"
              opacity=".25"
            />
          </pattern>
        </defs>
        <ellipse cx="220" cy="155" rx="201" ry="150" fill="url(#sky)" />
        <circle cx="224" cy="150" r="124" fill="url(#grid)" />
        <circle
          cx="224"
          cy="150"
          r="125"
          fill="none"
          stroke="#ccd2b8"
          strokeDasharray="3 7"
        />
        <path d="M0 273q70-35 133-9t151-4 156 3v47H0" fill="#e8ebd9" />
        <path d="M0 290q100-38 207-2t233-16" fill="none" stroke="#d4dcc3" />
        <path
          d="M48 265v-32m0 12q-24-18-18-28 24-2 18 28m0 12q21-22 28-13-3 20-28 13M382 278v-29m0 9q-22-15-18-25 21-3 18 25m0 10q24-20 29-10-7 18-29 10"
          fill="#a8bd8e"
          stroke="#90a477"
          strokeWidth="1.5"
        />
        <path
          d="M80 93h10m-5-5v10M355 120h12m-6-6v12"
          stroke="#b0bb8d"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="339" cy="55" r="4" fill="#e4c78f" />
        <circle cx="103" cy="184" r="3" fill="#cfb789" />
        <path d="M62 147q10-14 18 0-8 14-18 0" fill="none" stroke="#c5cba9" />
        <path
          d="M322 208l10-17 10 17z"
          fill="none"
          stroke="#c5cba9"
          strokeWidth="1.5"
        />
      </svg>
      <span className="art-note note-left">每一步，都算数</span>
      <span className="art-note note-right">慢慢来就好</span>
      <Mascot sleeping={sleeping} />
      <span className="ground-label">YOUR LITTLE LEARNING COMPANION</span>
    </div>
  );
}
export function MapArt() {
  return (
    <svg className="map-art" viewBox="0 0 400 510" aria-hidden="true">
      <defs>
        <pattern
          id="mapgrid"
          width="25"
          height="25"
          patternUnits="userSpaceOnUse"
        >
          <path d="M25 0H0v25" stroke="#bfc9ad" opacity=".22" fill="none" />
        </pattern>
      </defs>
      <rect width="400" height="510" fill="url(#mapgrid)" />
      <path
        d="M-20 96Q70 15 150 74T330 34L430 60V250Q343 185 260 239T80 222L-20 241Z"
        fill="#e3ebd7"
      />
      <path
        d="M-20 410Q60 340 145 395T290 363L430 390V540H-20Z"
        fill="#e6e9d4"
      />
      <path
        d="M-20 330Q96 264 154 322T425 259"
        stroke="#d5e4e0"
        strokeWidth="26"
        fill="none"
      />
      <path
        d="M-20 330Q96 264 154 322T425 259"
        stroke="#eef4eb"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M104 107C48 187 304 151 281 230S65 263 115 338 304 343 280 437"
        stroke="#c7b78f"
        strokeWidth="3"
        strokeDasharray="4 9"
        strokeLinecap="round"
        fill="none"
      />
      <g fill="#9fb58a">
        <path d="M334 116l14-29 14 29h-10v14h-8v-14zM37 397l14-29 14 29H55v14h-8v-14zM314 462l14-29 14 29h-10v14h-8v-14z" />
        <circle cx="62" cy="66" r="11" fill="#b5c59d" />
        <circle cx="51" cy="72" r="9" fill="#b5c59d" />
        <rect x="58" y="77" width="5" height="14" fill="#a9a07e" />
      </g>
      <g stroke="#b9bca5" fill="none" strokeWidth="1.3">
        <path d="M290 35l17-22 17 22M303 35l17-22 17 22M33 222l12-16 12 16M45 222l12-16 12 16" />
      </g>
      <g fill="#d6bc84">
        <circle cx="194" cy="105" r="3" />
        <circle cx="203" cy="98" r="3" />
        <circle cx="56" cy="279" r="3" />
        <circle cx="348" cy="366" r="3" />
      </g>
      <text x="251" y="71" fill="#8a9575" fontSize="10" letterSpacing="3">
        一点点探索
      </text>
    </svg>
  );
}
export function SpaceShape({ variant = "original" }: { variant?: string }) {
  const p =
    variant === "A"
      ? "M20 20h22v60h53v22H20z"
      : variant === "B"
        ? "M20 20h82v22H42v35H20z"
        : variant === "C"
          ? "M20 20h22v35h60v22H20z"
          : "M20 20h22v60h35v22H20z";
  return (
    <svg
      viewBox="0 0 120 120"
      aria-label={
        variant === "original" ? "L形：长边向上，短边向右" : `选项${variant}`
      }
      role="img"
    >
      <defs>
        <pattern
          id={`shape-${variant}`}
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path d="M20 0H0v20" stroke="#94a088" strokeWidth=".5" fill="none" />
        </pattern>
      </defs>
      <rect x="1" y="1" width="118" height="118" rx="10" fill="#f3f4ea" />
      <path d={p} fill="#9db789" stroke="#4f6d45" strokeWidth="2" />
      <rect
        x="1"
        y="1"
        width="118"
        height="118"
        fill={`url(#shape-${variant})`}
      />
    </svg>
  );
}
