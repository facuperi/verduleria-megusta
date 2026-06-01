const SkeletonBar = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-700 rounded ${className}`} />
);

const TextSkeleton = ({ rows = 3 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonBar key={i} className={`h-4 ${i === rows - 1 ? 'w-3/4' : 'w-full'}`} />
    ))}
  </div>
);

const CardSkeleton = ({ count = 1 }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-gray-800 p-4 rounded-lg shadow space-y-3">
        <SkeletonBar className="h-4 w-1/2" />
        <SkeletonBar className="h-8 w-1/3" />
        <SkeletonBar className="h-3 w-2/3" />
      </div>
    ))}
  </div>
);

const TableSkeleton = ({ rows = 5 }) => (
  <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
    <div className="border-b p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <SkeletonBar className="h-4 flex-1" />
          <SkeletonBar className="h-4 w-20" />
          <SkeletonBar className="h-4 w-24" />
          <SkeletonBar className="h-4 w-16" />
        </div>
      ))}
    </div>
  </div>
);

const PageSkeleton = () => (
  <div className="space-y-6">
    <SkeletonBar className="h-8 w-48" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-gray-800 p-6 rounded-lg shadow">
          <SkeletonBar className="h-4 w-1/2 mb-4" />
          <SkeletonBar className="h-8 w-1/3 mb-2" />
          <SkeletonBar className="h-3 w-2/3" />
        </div>
      ))}
    </div>
    <div className="bg-gray-800 p-6 rounded-lg shadow">
      <SkeletonBar className="h-4 w-1/4 mb-4" />
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBar key={i} className="h-4 w-full mb-3" />
      ))}
    </div>
  </div>
);

export const LoadingSkeleton = ({ type = 'text', rows = 3, count = 1, className = '' }) => {
  return (
    <div className={`py-8 ${className}`}>
      {type === 'text' && <TextSkeleton rows={rows} />}
      {type === 'card' && <CardSkeleton count={count} />}
      {type === 'table' && <TableSkeleton rows={rows} />}
      {type === 'page' && <PageSkeleton />}
    </div>
  );
};