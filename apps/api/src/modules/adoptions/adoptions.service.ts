import type { AdoptionStatus, Prisma } from '@prisma/client';
import type { CreateAdoptionInput } from '@bazar/shared';
import { publicCode } from '../../lib/codes';
import { AppError } from '../../lib/errors';
import { pageArgs, toPage } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { enqueueNotification } from '../notifications/outbox';

const OPEN: AdoptionStatus[] = ['RECEIVED', 'IN_REVIEW', 'INTERVIEW'];

/** Fluxo de triagem: RECEIVED → IN_REVIEW → INTERVIEW → APPROVED; qualquer etapa aberta → REJECTED. */
const TRANSITIONS: Record<AdoptionStatus, AdoptionStatus[]> = {
  RECEIVED: ['IN_REVIEW', 'REJECTED'],
  IN_REVIEW: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
};

export async function createAdoption(input: CreateAdoptionInput) {
  const animal = await prisma.animal.findUnique({ where: { slug: input.animalSlug } });
  if (!animal || animal.status === 'ADOPTED')
    throw AppError.badRequest('Este animal não está disponível para adoção');
  const duplicate = await prisma.adoptionRequest.findFirst({
    where: { animalId: animal.id, applicantEmail: input.applicantEmail, status: { in: OPEN } },
  });
  if (duplicate) {
    throw new AppError(
      409,
      'DUPLICATE_REQUEST',
      `Você já tem uma solicitação em andamento para ${animal.name} (protocolo ${duplicate.publicCode})`,
    );
  }
  const request = await prisma.$transaction(async (tx) => {
    const r = await tx.adoptionRequest.create({
      data: {
        publicCode: publicCode('ADO'),
        animalId: animal.id,
        applicantName: input.applicantName,
        applicantEmail: input.applicantEmail,
        applicantPhone: input.applicantPhone,
        city: input.city,
        answers: input.answers as Prisma.InputJsonValue,
        consentAt: new Date(),
      },
    });
    await enqueueNotification(
      tx,
      { email: r.applicantEmail, phone: r.applicantPhone },
      'ADOPTION_RECEIVED',
      {
        code: r.publicCode,
        name: r.applicantName.split(' ')[0],
        animalName: animal.name,
      },
    );
    return r;
  });
  return {
    code: request.publicCode,
    status: request.status,
    animal: { slug: animal.slug, name: animal.name },
  };
}

export async function getAdoptionByCode(code: string) {
  const r = await prisma.adoptionRequest.findUnique({
    where: { publicCode: code.toUpperCase() },
    include: { animal: { select: { slug: true, name: true, photos: true } } },
  });
  if (!r) throw AppError.notFound('Solicitação não encontrada');
  return {
    code: r.publicCode,
    status: r.status,
    animal: { slug: r.animal.slug, name: r.animal.name, photo: r.animal.photos[0] ?? null },
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listAdoptions(f: {
  page: number;
  pageSize: number;
  status?: AdoptionStatus;
}) {
  const where = { status: f.status };
  const [data, total] = await Promise.all([
    prisma.adoptionRequest.findMany({
      where,
      include: { animal: { select: { id: true, slug: true, name: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      ...pageArgs(f),
    }),
    prisma.adoptionRequest.count({ where }),
  ]);
  return toPage(data, total, f);
}

export async function getAdoption(id: string) {
  const r = await prisma.adoptionRequest.findUnique({ where: { id }, include: { animal: true } });
  if (!r) throw AppError.notFound('Solicitação não encontrada');
  return r;
}

/**
 * Avança a triagem. Efeitos no animal: INTERVIEW → IN_ADOPTION; APPROVED → ADOPTED (e demais
 * solicitações abertas para o mesmo animal são recusadas); REJECTED → volta a AVAILABLE se não
 * houver outra entrevista em andamento.
 */
export async function updateAdoptionStatus(id: string, status: AdoptionStatus, notes?: string) {
  await prisma.$transaction(async (tx) => {
    const r = await tx.adoptionRequest.findUnique({ where: { id }, include: { animal: true } });
    if (!r) throw AppError.notFound('Solicitação não encontrada');
    if (!TRANSITIONS[r.status].includes(status)) {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `Não é possível mudar de ${r.status} para ${status}`,
      );
    }
    if (status === 'APPROVED' && r.animal.status === 'ADOPTED')
      throw AppError.conflict(`${r.animal.name} já foi adotado(a)`);

    await tx.adoptionRequest.update({
      where: { id },
      data: { status, ...(notes !== undefined ? { notes } : {}) },
    });
    const notify = (
      req: { publicCode: string; applicantEmail: string; applicantPhone: string },
      st: AdoptionStatus,
    ) =>
      enqueueNotification(
        tx,
        { email: req.applicantEmail, phone: req.applicantPhone },
        'ADOPTION_STATUS',
        {
          code: req.publicCode,
          animalName: r.animal.name,
          status: st,
        },
      );
    await notify(r, status);

    if (status === 'INTERVIEW' && r.animal.status === 'AVAILABLE') {
      await tx.animal.update({ where: { id: r.animalId }, data: { status: 'IN_ADOPTION' } });
    }
    if (status === 'APPROVED') {
      await tx.animal.update({ where: { id: r.animalId }, data: { status: 'ADOPTED' } });
      const others = await tx.adoptionRequest.findMany({
        where: { animalId: r.animalId, id: { not: id }, status: { in: OPEN } },
      });
      for (const o of others) {
        await tx.adoptionRequest.update({
          where: { id: o.id },
          data: { status: 'REJECTED', notes: 'Animal adotado por outro interessado' },
        });
        await notify(o, 'REJECTED');
      }
    }
    if (status === 'REJECTED' && r.animal.status === 'IN_ADOPTION') {
      const interviewing = await tx.adoptionRequest.count({
        where: { animalId: r.animalId, status: 'INTERVIEW', id: { not: id } },
      });
      if (interviewing === 0)
        await tx.animal.update({ where: { id: r.animalId }, data: { status: 'AVAILABLE' } });
    }
  });
  return getAdoption(id);
}
