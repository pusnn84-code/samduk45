import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({execute:vi.fn()}));
vi.mock('../../src/db/client',()=>({getDb:()=>({execute:mock.execute})}));
import {exportSubmittedReports} from '../../src/features/pastoral/reports';
import {PgDialect} from 'drizzle-orm/pg-core';
beforeEach(()=>{mock.execute.mockReset();mock.execute.mockResolvedValue({rows:[]})});
describe('private pastoral bulk export',()=>{
 it('rejects a member before querying pastoral data',async()=>{
  await expect(exportSubmittedReports({id:'viewer',displayName:'가상',role:'member'})).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(mock.execute).not.toHaveBeenCalled();
 });
 it('exports all submitted text newest first without marking reports reviewed',async()=>{
  expect(await exportSubmittedReports({id:'admin',displayName:'가상',role:'admin'})).toBe('\uFEFF');
  const query=new PgDialect().sqlToQuery(mock.execute.mock.calls[0][0]);
  expect(query.sql).toContain('p.submitted_at is not null');
  expect(query.sql).toContain('order by p.submitted_at desc');
  expect(query.sql).not.toContain('limit 20');
  expect(query.sql).not.toMatch(/update|delete|insert/i);
 });
});
