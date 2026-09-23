const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let out = 'Name of Work,district_name,financial_year,Sanctioned Amount (Rs.),Date of Sanction,work_status,sector,expenditure_incurred,executing_agency\n';
for(let i=1; i<=89; i++) {
  out += `Road construction ${i},DIST-01,2021-22,500000,12/10/21,complete,Roads,500000,Agency X\n`;
}
// 1 planted duplicate (same as row 1)
out += `Road construction 1,DIST-01,2021-22,500000,12/10/21,complete,Roads,500000,Agency X\n`;
// 8 warnings (expenditure > sanctioned)
for(let i=1; i<=8; i++) {
  out += `Water tank ${i},DIST-01,2021-22,100000,10-10-2021,ongoing,Drinking Water,200000,Agency Y\n`;
}
// 2 fatal (bad date, missing amount)
out += `Fatal 1,DIST-01,2021-22,100000,invalid-date,ongoing,Health,0,Agency Z\n`;
out += `Fatal 2,DIST-01,2021-22,,10-10-2021,ongoing,Education,0,Agency Z\n`;

fs.writeFileSync(path.join(dir, 'oms_sample_100.csv'), out);
