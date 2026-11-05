// Read-only schema/scope check; this script never inserts users, sessions, or grades.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
require('dotenv').config({quiet:true});
const db=require('../dist/core/database/data-source').default;
const {MysqlGradeRepository}=require('../dist/modules/grades/infrastructure/grade.repository');
async function run(){
 await db.initialize();
 const hash=async()=>crypto.createHash('sha256').update(JSON.stringify(await db.query('SELECT * FROM student_course_results ORDER BY id'))).digest('hex');
 const before=await hash();
 const roles=await db.query(`SELECT r.role_code,p.permission_code FROM roles r JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id WHERE r.role_code='LECTURER' AND p.permission_code IN ('GRADE_READ','GRADE_MANAGE')`);
 assert(roles.some(r=>r.permission_code==='GRADE_READ'));assert(!roles.some(r=>r.permission_code==='GRADE_MANAGE'));
 const users=await db.query(`SELECT DISTINCT CAST(u.id AS CHAR) id,u.username FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.account_status='ACTIVE' AND u.deleted_at IS NULL AND r.role_code='TRAINING_OFFICER' AND r.status='ACTIVE' ORDER BY u.id LIMIT 2`);
 assert(users.length,'At least one officer is needed for read-only scope checks');
 const repository=new MysqlGradeRepository(db);let combinations=0;
 for(const user of users){const actor={...user,canManage:true,ip:'127.0.0.1'};const options=await repository.excelOptions(actor);assert(Array.isArray(options.data));
   // Exercise the complete query even when there are no class memberships yet.
   await repository.excelRows('1','1',actor);
   for(const option of options.data.slice(0,5)){const rows=await repository.excelRows(option.classId,option.termId,actor);assert(Array.isArray(rows));for(const row of rows){assert(row.registrationId);assert(row.studentCode);assert(row.courseCode);}combinations++;}
 }
 assert.equal(await hash(),before,'Grade data changed during read-only checks');
 console.log(`PASS: lecturer permissions, faculty/class/term SQL and scope for ${users.length} officers, ${combinations} class-term combinations; grades unchanged.`);
}
run().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{if(db.isInitialized)await db.destroy();});
