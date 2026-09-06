import { createHmac, randomUUID } from 'node:crypto';
import sharp from 'sharp';

export interface ProvenanceRecord {
  version: 1;
  site: string;
  projectName: string;
  jobId: string;
  provider: string;
  model: string;
  createdAt: string;
  fingerprintId: string;
  signature: string;
}

function secret() {
  const value = process.env.SOLAMENTIS_PROVENANCE_SECRET?.trim();
  if (!value) throw new Error('SOLAMENTIS_PROVENANCE_SECRET is required for protected image provenance');
  return value;
}

export function buildProvenance(input: Omit<ProvenanceRecord, 'version' | 'fingerprintId' | 'signature'> & { fingerprintId?: string }): ProvenanceRecord {
  const fingerprintId = input.fingerprintId ?? randomUUID();
  const unsigned = {
    version: 1 as const,
    site: input.site,
    projectName: input.projectName,
    jobId: input.jobId,
    provider: input.provider,
    model: input.model,
    createdAt: input.createdAt,
    fingerprintId,
  };
  const payload = JSON.stringify(unsigned);
  const signature = createHmac('sha256', secret()).update(payload).digest('hex');
  return { ...unsigned, signature };
}

export async function embedProvenance(input: Buffer, record: ProvenanceRecord): Promise<Buffer> {
  const encoded = Buffer.from(JSON.stringify(record), 'utf8').toString('base64url');
  const xmp = `<?xml version="1.0"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:solamentis="https://solamentis.app/ns/1.0/" solamentis:provenance="${encoded}" solamentis:site="Solamentis"/></rdf:RDF></x:xmpmeta>`;
  return sharp(input)
    .withExif({ IFD0: { Software: 'Solamentis', ImageDescription: `SOLAMENTIS-PROVENANCE-V1:${encoded}` } })
    .withXmp(xmp)
    .toBuffer();
}
