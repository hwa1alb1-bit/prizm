// Shared numeral pill used by the marketing "From PDF to clean spreadsheet
// in four steps" section and the dashboard's Conversion path.

export function StepNumeral({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-[0_3px_8px_rgba(79,70,229,0.24)]"
      style={{
        background:
          'radial-gradient(circle at 28% 26%, #2DD4BF 0%, #4F46E5 55%, #3730A3 100%)',
      }}
    >
      {n}
    </span>
  )
}
