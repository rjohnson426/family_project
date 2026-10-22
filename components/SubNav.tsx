/** Bar under the global nav on a folder page: sort, tile size and download. */
export default function SubNav({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-stone-200/70">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">{children}</div>
    </div>
  );
}
