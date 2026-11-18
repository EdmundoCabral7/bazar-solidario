import Link from 'next/link';
import type { Animal } from '@/lib/types';
import { SEXES, SIZES, SPECIES } from '@/lib/labels';
import { formatAge } from '@/lib/utils';
import { StatusBadge } from './status-badge';

export function AnimalCard({ animal, href }: { animal: Animal; href?: string }) {
  return (
    <Link
      href={href ?? `/adote/${animal.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
    >
      <img
        src={animal.photos[0] ?? '/placeholder.svg'}
        alt=""
        loading="lazy"
        className="aspect-[4/3] w-full bg-muted object-cover"
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold group-hover:text-primary">{animal.name}</h3>
          {animal.status !== 'AVAILABLE' && <StatusBadge kind="animal" value={animal.status} />}
        </div>
        <p className="text-sm text-muted-foreground">
          {SPECIES[animal.species]} · {SEXES[animal.sex]} · {SIZES[animal.size]} ·{' '}
          {formatAge(animal.ageMonths)}
        </p>
        <p className="line-clamp-2 text-sm">{animal.description}</p>
      </div>
    </Link>
  );
}
