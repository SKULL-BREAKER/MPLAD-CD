import { structureProposal } from './lib/modules/proposal.js';
(async () => {
  try {
    const res = await structureProposal({
      constituency_id: 'DIST-001',
      member_id: 'MP-001',
      year_val: '2019-20',
      public_utility_term_id: 'Education',
      public_locality_term_id: 'RURAL-001',
      requested_amount: 500000,
    });
    console.log(res);
  } catch (e) {
    console.error(e);
  }
})();
