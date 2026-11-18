/**
 * Seed básico: admin de demonstração, catálogo de serviços de TI (S01–S08),
 * animais, peças do bazar, despesas e um parceiro com API key.
 * Idempotente: pode ser executado várias vezes.
 * Entidade SIMULADA para fins acadêmicos — Associação Patas Potiguares.
 */
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const placeholder = (seed: string) =>
  `https://placehold.co/800x600/f3e8d8/7a4a2a?text=${encodeURIComponent(seed)}`;

const itServices = [
  {
    code: 'S01',
    name: 'Loja do bazar online',
    owner: 'Coordenação do bazar',
    availabilityTarget: 99.5,
    description: 'Vitrine, carrinho e checkout das peças do bazar.',
  },
  {
    code: 'S02',
    name: 'Doações e apadrinhamento',
    owner: 'Tesouraria',
    availabilityTarget: 99.5,
    description: 'Doação avulsa via Pix/cartão e apadrinhamento mensal.',
  },
  {
    code: 'S03',
    name: 'Adoção online',
    owner: 'Coordenação de adoções',
    availabilityTarget: 99.5,
    description: 'Vitrine de animais e formulário de adoção com triagem.',
  },
  {
    code: 'S04',
    name: 'Painel de transparência',
    owner: 'Tesouraria',
    availabilityTarget: 99,
    description: 'Arrecadação e gastos publicados mensalmente.',
  },
  {
    code: 'S05',
    name: 'Painel administrativo',
    owner: 'Responsável de TI',
    availabilityTarget: 99,
    description: 'Gestão de animais, peças, pedidos, adoções e despesas.',
  },
  {
    code: 'S06',
    name: 'Gestão de acessos',
    owner: 'Responsável de TI',
    availabilityTarget: 99,
    description: 'Criação e revogação de contas de voluntários e chaves de parceiros.',
  },
  {
    code: 'S07',
    name: 'Backup e proteção de dados',
    owner: 'Responsável de TI',
    availabilityTarget: null,
    rpoHours: 24,
    rtoHours: 4,
    description: 'Backup diário do banco e restauração (RPO 24 h, RTO 4 h).',
  },
  {
    code: 'S08',
    name: 'Central de atendimento',
    owner: 'Responsável de TI',
    availabilityTarget: 99,
    description: 'Abertura e acompanhamento de chamados (incidentes e requisições).',
  },
];

const animals = [
  {
    slug: 'caramelo',
    name: 'Caramelo',
    species: 'DOG',
    ageMonths: 24,
    size: 'MEDIUM',
    sex: 'MALE',
    neutered: true,
    vaccinated: true,
    description: 'Dócil, adora passear e se dá bem com crianças.',
  },
  {
    slug: 'mel',
    name: 'Mel',
    species: 'DOG',
    ageMonths: 8,
    size: 'SMALL',
    sex: 'FEMALE',
    neutered: false,
    vaccinated: true,
    description: 'Filhote brincalhona resgatada em Ponta Negra.',
  },
  {
    slug: 'trovao',
    name: 'Trovão',
    species: 'DOG',
    ageMonths: 60,
    size: 'LARGE',
    sex: 'MALE',
    neutered: true,
    vaccinated: true,
    description: 'Grandão calmo, ideal para casa com quintal.',
  },
  {
    slug: 'luna',
    name: 'Luna',
    species: 'CAT',
    ageMonths: 12,
    size: 'SMALL',
    sex: 'FEMALE',
    neutered: true,
    vaccinated: true,
    description: 'Gata carinhosa e tranquila, acostumada com apartamento.',
  },
  {
    slug: 'frajola',
    name: 'Frajola',
    species: 'CAT',
    ageMonths: 36,
    size: 'MEDIUM',
    sex: 'MALE',
    neutered: true,
    vaccinated: false,
    description: 'Independente e curioso, convive bem com outros gatos.',
  },
  {
    slug: 'pipoca',
    name: 'Pipoca',
    species: 'CAT',
    ageMonths: 4,
    size: 'SMALL',
    sex: 'FEMALE',
    neutered: false,
    vaccinated: false,
    description: 'Filhote cheia de energia procurando um lar.',
  },
] as const;

const products = [
  {
    slug: 'camisa-polo-azul-m',
    title: 'Camisa polo azul',
    category: 'Roupas',
    size: 'M',
    condition: 'LIKE_NEW',
    priceCents: 2500,
    description: 'Camisa polo masculina, pouquíssimo uso.',
  },
  {
    slug: 'vestido-floral-p',
    title: 'Vestido floral',
    category: 'Roupas',
    size: 'P',
    condition: 'GOOD',
    priceCents: 3500,
    description: 'Vestido leve, ótimo para o verão potiguar.',
  },
  {
    slug: 'tenis-corrida-40',
    title: 'Tênis de corrida',
    category: 'Calçados',
    size: '40',
    condition: 'GOOD',
    priceCents: 6000,
    description: 'Tênis esportivo em bom estado.',
  },
  {
    slug: 'livro-romance',
    title: 'Livro de romance nacional',
    category: 'Livros',
    size: null,
    condition: 'GOOD',
    priceCents: 1500,
    description: 'Edição brochura, páginas conservadas.',
  },
  {
    slug: 'caneca-patas',
    title: 'Caneca Patas Potiguares',
    category: 'Acessórios',
    size: null,
    condition: 'NEW',
    priceCents: 3000,
    description: 'Caneca de cerâmica com estampa da campanha.',
    stock: 10,
  },
  {
    slug: 'bolsa-palha',
    title: 'Bolsa de palha artesanal',
    category: 'Acessórios',
    size: null,
    condition: 'LIKE_NEW',
    priceCents: 4500,
    description: 'Bolsa feita por artesã de São José de Mipibu.',
  },
] as const;

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@pataspotiguares.org').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: 'Administrador(a) Demo', email: adminEmail, passwordHash, role: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { email: 'voluntario@pataspotiguares.org' },
    update: {},
    create: {
      name: 'Voluntário(a) Demo',
      email: 'voluntario@pataspotiguares.org',
      passwordHash,
      role: 'VOLUNTEER',
    },
  });
  await prisma.user.upsert({
    where: { email: 'ti@pataspotiguares.org' },
    update: {},
    create: {
      name: 'Responsável de TI Demo',
      email: 'ti@pataspotiguares.org',
      passwordHash,
      role: 'SUPPORT_N2',
    },
  });

  for (const s of itServices) {
    await prisma.itService.upsert({ where: { code: s.code }, update: s, create: s });
  }

  for (const a of animals) {
    await prisma.animal.upsert({
      where: { slug: a.slug },
      update: {},
      create: { ...a, photos: [placeholder(a.name)] },
    });
  }

  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...p, photos: [placeholder(p.title)] },
    });
  }

  if ((await prisma.expense.count()) === 0) {
    const now = new Date();
    const categories = ['RACAO', 'VETERINARIO', 'CASTRACAO', 'MANUTENCAO', 'OUTROS'] as const;
    const data = [];
    for (let m = 0; m < 3; m++) {
      for (const [i, category] of categories.entries()) {
        data.push({
          category,
          description: `Gasto mensal — ${category.toLowerCase()}`,
          amountCents: (i + 1) * 3500 + m * 500,
          spentAt: new Date(now.getFullYear(), now.getMonth() - m, 5 + i),
        });
      }
    }
    await prisma.expense.createMany({ data });
  }

  // Campanhas ativas (expostas na API pública)
  const campaigns = [
    {
      slug: 'mutirao-castracao-2026',
      title: 'Mutirão de castração 2026',
      description: 'Meta: castrar 60 animais de rua em Natal até o fim do ano.',
      goalCents: 900000,
    },
    {
      slug: 'racao-de-inverno',
      title: 'Ração para a temporada de chuvas',
      description: 'Estoque de ração para os meses de chuva, quando as adoções caem.',
      goalCents: 400000,
    },
  ];
  for (const c of campaigns) {
    await prisma.campaign.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        ...c,
        startsAt: new Date(Date.now() - 30 * 86400_000),
        endsAt: new Date(Date.now() + 60 * 86400_000),
      },
    });
  }

  // Histórico financeiro simulado (3 meses) para o painel de transparência
  if (
    !(await prisma.sponsorship.findUnique({ where: { gatewaySubscriptionId: 'mock-sub-seed-1' } }))
  ) {
    const campaign = await prisma.campaign.findUniqueOrThrow({
      where: { slug: 'mutirao-castracao-2026' },
    });
    const now = new Date();
    const at = (monthsBack: number, day: number) =>
      new Date(now.getFullYear(), now.getMonth() - monthsBack, Math.min(day, 28), 15);
    for (let m = 2; m >= 0; m--) {
      for (let i = 0; i < 6 + m; i++) {
        const amountCents = [2000, 5000, 3000, 10000, 2500, 7500, 15000, 4000][i % 8]!;
        const paidAt = at(m, 2 + i * 3);
        if (paidAt > now) continue;
        await prisma.donation.create({
          data: {
            amountCents,
            anonymous: i % 3 === 0,
            donorName: i % 3 === 0 ? null : `Doador(a) Simulado(a) ${i + 1}`,
            campaignId: i % 2 === 0 ? campaign.id : null,
            createdAt: paidAt,
            payment: {
              create: {
                provider: 'mock',
                method: 'PIX',
                status: 'APPROVED',
                amountCents,
                paidAt,
                createdAt: paidAt,
              },
            },
          },
        });
      }
    }
    const sponsoredAnimal = await prisma.animal.findUniqueOrThrow({ where: { slug: 'trovao' } });
    const sponsorship = await prisma.sponsorship.create({
      data: {
        animalId: sponsoredAnimal.id,
        plan: 'P50',
        amountCents: 5000,
        sponsorName: 'Madrinha Simulada',
        sponsorEmail: 'madrinha@exemplo.org',
        status: 'ACTIVE',
        gatewaySubscriptionId: 'mock-sub-seed-1',
        consentAt: at(2, 1),
      },
    });
    for (let m = 2; m >= 0; m--) {
      const paidAt = at(m, 5);
      if (paidAt > now) continue;
      await prisma.payment.create({
        data: {
          provider: 'mock',
          externalId: `mock-ap-seed-${m}`,
          method: 'CARD',
          status: 'APPROVED',
          amountCents: 5000,
          paidAt,
          createdAt: paidAt,
          sponsorshipId: sponsorship.id,
        },
      });
    }
    console.log('Histórico de doações e apadrinhamentos simulado criado.');
  }

  if ((await prisma.partner.count()) === 0) {
    const apiKey = `bz_live_${randomBytes(24).toString('hex')}`;
    await prisma.partner.create({
      data: {
        name: 'Pet Shop Parceiro Demo',
        contactEmail: 'contato@petshopdemo.example',
        apiKeyPrefix: apiKey.slice(0, 12),
        apiKeyHash: createHash('sha256').update(apiKey).digest('hex'),
      },
    });
    console.log(`\nAPI key do parceiro demo (guarde, não será exibida de novo):\n  ${apiKey}\n`);
  }

  console.log(`Seed concluído. Admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
