# API pública do Bazar Solidário — guia para parceiros

> Associação Patas Potiguares (**entidade simulada para fins acadêmicos**).

Pet shops, clínicas veterinárias e outros parceiros podem exibir em seus sites e telas os
**animais disponíveis para adoção** e as **campanhas ativas** da associação, com links diretos
para adotar, apadrinhar ou doar.

- **Base URL:** `https://<endereço-da-api>/api/public/v1` (local: `http://localhost:3333/api/public/v1`)
- **Formato:** JSON, UTF-8. Valores em **centavos**.
- **Acesso:** somente leitura.
- **Limite:** 60 requisições por minuto **por chave**. Os headers `RateLimit-*` informam o saldo; acima do limite a resposta é `429`.
- **Documentação interativa:** `/docs` (seção _API pública v1_).

## 1. Como obter a chave

1. Peça o cadastro à associação (por um chamado em **Suporte** → serviço _S06 — Gestão de acessos_).
2. Um administrador cadastra o parceiro no painel (ou via `POST /api/admin/partners`) e recebe a chave
   **uma única vez**, no formato `bz_live_...`. Guarde-a em local seguro (variável de ambiente, cofre de segredos).
3. A associação guarda apenas um _hash_ da chave. Se ela vazar, peça a **rotação** (nova chave, a antiga para na hora)
   ou a **revogação**.

Em desenvolvimento, `npm run db:seed` cria o parceiro _Pet Shop Parceiro Demo_ e imprime a chave no terminal.

## 2. Autenticação

Envie a chave no header `x-api-key` em todas as requisições:

```bash
export BAZAR_KEY=bz_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
curl -H "x-api-key: $BAZAR_KEY" http://localhost:3333/api/public/v1/animals
```

## 3. Endpoints

### `GET /animals` — animais disponíveis

| Parâmetro  | Valores                    | Padrão |
| ---------- | -------------------------- | ------ |
| `species`  | `DOG`, `CAT`               | todos  |
| `size`     | `SMALL`, `MEDIUM`, `LARGE` | todos  |
| `page`     | ≥ 1                        | 1      |
| `pageSize` | 1–100                      | 20     |

```bash
curl -H "x-api-key: $BAZAR_KEY" "http://localhost:3333/api/public/v1/animals?species=CAT&pageSize=2"
```

```json
{
  "data": [
    {
      "id": "luna",
      "name": "Luna",
      "species": "CAT",
      "ageMonths": 12,
      "size": "SMALL",
      "sex": "FEMALE",
      "neutered": true,
      "vaccinated": true,
      "description": "Gata carinhosa e tranquila, acostumada com apartamento.",
      "photos": ["https://placehold.co/800x600/f3e8d8/7a4a2a?text=Luna"],
      "status": "AVAILABLE",
      "adoptUrl": "http://localhost:3000/adote/luna",
      "sponsorUrl": "http://localhost:3000/doe/apadrinhar/luna"
    }
  ],
  "page": 1,
  "pageSize": 2,
  "total": 3
}
```

`status` pode ser `AVAILABLE` (disponível) ou `IN_ADOPTION` (em processo — ainda pode receber interessados).

### `GET /animals/{id}` — um animal

```bash
curl -H "x-api-key: $BAZAR_KEY" http://localhost:3333/api/public/v1/animals/luna
```

Retorna `404` se o animal não existe ou já foi adotado.

### `GET /campaigns` — campanhas ativas

```bash
curl -H "x-api-key: $BAZAR_KEY" http://localhost:3333/api/public/v1/campaigns
```

```json
{
  "data": [
    {
      "id": "mutirao-castracao-2026",
      "title": "Mutirão de castração 2026",
      "description": "Meta: castrar 60 animais de rua em Natal até o fim do ano.",
      "goalCents": 900000,
      "raisedCents": 26000,
      "progressPct": 3,
      "startsAt": "2026-10-19T22:00:00.000Z",
      "endsAt": "2027-01-17T22:00:00.000Z",
      "donateUrl": "http://localhost:3000/doe?campanha=mutirao-castracao-2026"
    }
  ]
}
```

## 4. Erros

Formato único: `{ "error": { "code": "...", "message": "..." } }`.

| HTTP | `code`             | Significado                          |
| ---- | ------------------ | ------------------------------------ |
| 401  | `API_KEY_REQUIRED` | Header `x-api-key` ausente           |
| 401  | `INVALID_API_KEY`  | Chave inexistente ou revogada        |
| 404  | `NOT_FOUND`        | Recurso não encontrado               |
| 429  | `RATE_LIMITED`     | Mais de 60 req/min com a mesma chave |

## 5. Boas práticas

- **Cache** do seu lado por alguns minutos: a lista de animais muda poucas vezes por dia.
- Envie `x-correlation-id` (um UUID) se quiser que a associação localize a sua requisição nos logs ao investigar um problema.
- Não exponha a chave no navegador: chame a API a partir do seu servidor.
- Para dúvidas ou incidentes, abra um chamado em **Suporte** informando o horário e o `x-correlation-id` da resposta.
