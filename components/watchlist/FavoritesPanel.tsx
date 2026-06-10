import type { CalendarEvent } from "@/lib/mock-calendar-data";

interface Props {
  events: CalendarEvent[];
}

export default function FavoritesPanel({ events }: Props) {
  const favorites = events.filter((event) => event.favorite).slice(0, 5);
  return (
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-4">
      <h2 className="mb-3 text-[15px] font-bold text-slate-200">즐겨찾기</h2>
      <div className="space-y-2">
        {favorites.map((event) => (
          <div key={event.id} className="flex items-center justify-between rounded-xl bg-[#141a1b] px-3 py-2 text-[12px]">
            <span className="font-semibold text-white">{event.favorite} {event.ticker}</span>
            <span className="text-slate-400">{event.date}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
