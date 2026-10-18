const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const array = (name) => ({ type: 'array', items: ref(name) });
const string = (maxLength, nullable = false) => ({ type: 'string', ...(maxLength ? { maxLength } : {}), nullable });
const integer = (nullable = false) => ({ type: 'integer', minimum: 1, nullable });
const record = (properties, required = []) => ({ type: 'object', additionalProperties: false, properties, required });
const json = (schema) => ({ 'application/json': { schema } });
const error = (description) => ({ description, content: json(ref('ErrorResponse')) });
const idParam = { name: 'id', in: 'path', required: true, schema: integer() };
export const v3Schemas = {
  ErrorResponse: { type: 'object', properties: { message: string(), error: { type: 'object', required: ['code','message','request_id'], properties: { code: string(), message: string(), request_id: { type: 'string', format: 'uuid' }, details: { type: 'object', additionalProperties: true } } } } },
  UserWrite: record({ auth_provider: string(10), username: string(50), cognito_sub: string(64,true), role: { type:'string', enum:['student','advisor','staff','company'] }, th_name: string(255), en_name: string(255), email: { type:'string', format:'email' }, phone: string(20,true), is_active: { type:'boolean' }, advisor_id: integer(true), company_id: integer(), job_title: string(150,true) }),
  CourseGrades:{type:'object',maxProperties:50,description:'เกรดแยกตามรหัสวิชา เช่น คพ.100; IP = กำลังศึกษา',additionalProperties:{type:'string',enum:['A','B+','B','C+','C','D+','D','F','IP']}},
  Declarations:record({mustPass:{type:'boolean'},discipline:{type:'boolean'},accept:{type:'boolean'}}),
  StudentWrite: record({ curriculum:{type:'string',enum:['61','66'],nullable:true},course_grades:ref('CourseGrades'),declarations:ref('Declarations'),gpax: { type:'number', minimum:0, maximum:4, multipleOf:0.01, nullable:true }, phone:string(20,true), transcript_s3_key:string(512,true) }),
  CompanyWrite: record({ name:string(255), logo:string(255,true), description:string(20000,true), province:string(100,true), location:string(10000,true), application_start:{type:'string',format:'date',nullable:true}, application_end:{type:'string',format:'date',nullable:true} }),
  PositionWrite: record({ company_id:integer(), name:string(255), description:string(20000,true), quota:{type:'integer',minimum:0,nullable:true}, term_id:integer(true), is_open:{type:'boolean'} }),
  TermWrite: record({ code:{type:'string',pattern:'^[123]/25[0-9]{2}$'}, ...Object.fromEntries(['plan_open_at','plan_close_at','coop_start','coop_end'].map((key) => [key,{type:'string',format:'date'}])) }, ['code','plan_open_at','plan_close_at','coop_start','coop_end']),
  ApplicationWrite: record({ position_id:integer(), term_id:integer(), resume_s3_key:string(512) }, ['position_id','resume_s3_key']),
  ReviewWrite: record({ status:{type:'string',enum:['approved','rejected']}, comment:string(10000,true) }, ['status']),
  DecisionWrite: record({ status:{type:'string',enum:['accepted','declined']} }, ['status']),
  Application: { type:'object', properties:{ application_id:integer(), student_id:integer(), term_id:integer(), position_id:integer(), status:{type:'string',enum:['submitted','approved','rejected','accepted','declined','confirmed','released','withdrawn']}, company_name:string(), position_name:string(), term:string(), resume_s3_key:string(512,true), resume_url:string(undefined,true), transcript_url:string(undefined,true), submitted_at:{type:'string',format:'date-time',nullable:true}, student:ref('User'), reviews:array('Review'), history:array('History') } },
  Review:{type:'object',properties:{review_id:integer(),reviewer_id:integer(),reviewer_name:string(),reviewer_role:string(),status:{type:'string',enum:['approved','rejected']},comment:string(undefined,true),created_at:{type:'string',format:'date-time'}}},
  History:{type:'object',properties:{history_id:integer(),from:string(20,true),to:string(20),by:string(undefined,true),at:{type:'string',format:'date-time'},position_id:integer(),resume_s3_key:string(512,true)}},
  Term:{type:'object',properties:{code:string(20),...Object.fromEntries(['plan_open_at','plan_close_at','coop_start','coop_end'].map((key) => [key,{type:'string',format:'date'}])),term_id:integer(),is_active:{type:'boolean'}}},
  Position:{type:'object',properties:{company_id:integer(),name:string(255),description:string(undefined,true),quota:{type:'integer',minimum:0,nullable:true},term_id:integer(true),is_open:{type:'boolean'},position_id:integer(),id:integer(),applicant_count:{type:'integer'},accepted_count:{type:'integer'}}},
};
v3Schemas.User = {type:'object',properties:{...v3Schemas.UserWrite.properties,curriculum:{type:'string',enum:['61','66'],nullable:true},course_grades:{...ref('CourseGrades'),nullable:true},declarations:{...ref('Declarations'),nullable:true},qualification_locked:{type:'boolean'},user_id:integer(),student_id:integer(true),gpax:{type:'number',nullable:true},advisor_name:string(undefined,true),transcript_s3_key:string(512,true),student_code:string(),application_count:{type:'integer'},pending_count:{type:'integer'},applications:array('Application')}};
delete v3Schemas.User.properties.cognito_sub;
const paths = {};
function add(path, method, tag, summary, response, body, { status = 200, public: anonymous = false, parameters = [], binary = false } = {}) {
  const operation = { tags:[tag], summary, security: anonymous ? [] : [{BearerAuth:[]}], parameters:[...(path.includes('{id}') ? [idParam] : []),...parameters], responses:{[status]:{description:'สำเร็จ',...(status !== 204 ? {content:json(response)} : {})},400:error('JSON ไม่ถูกต้อง'),401:error('ต้องเข้าสู่ระบบ'),403:error('ไม่มีสิทธิ์'),404:error('ไม่พบข้อมูล'),409:error('ข้อมูลซ้ำ/สถานะเปลี่ยนแล้ว/ข้อมูลอ้างอิง/transaction ขัดแย้ง'),413:error('ไฟล์หรือข้อมูลใหญ่เกินกำหนด'),422:error('ข้อมูลไม่ถูกต้องหรือไม่ผ่านคุณสมบัติ'),503:error('บริการยังไม่พร้อม')} };
  if (body) operation.requestBody = {required:true,content:binary ? {'application/pdf':{schema:{type:'string',format:'binary'}}} : json(ref(body))};
  paths[`/api${path}`] ??= {};
  paths[`/api${path}`][method] = operation;
}
add('/auth/login','post','Auth','Local development only: role comes from the database', {type:'object',properties:{user:ref('User'),token:string(),expires_in:{type:'integer'}}}, 'LoginWrite',{public:true});
v3Schemas.LoginWrite = record({email:{type:'string',format:'email'},password:{type:'string',format:'password'}},['email','password']);
add('/auth/me','get','Auth','ข้อมูลบัญชีที่เข้าสู่ระบบ',ref('User'));
add('/users','get','Users','Staff: ผู้ใช้ทั้งหมด',array('User'));
add('/users','post','Users','Staff: สร้างผู้ใช้พร้อม students/company_users ใน transaction',ref('User'),'UserWrite',{status:201});
for (const method of ['put','patch']) add('/users/{id}',method,'Users','Staff: แก้ไขข้อมูล/สถานะ ห้ามเปลี่ยน role หรือปิดบัญชีตนเอง',ref('User'),'UserWrite');
for (const path of ['/students','/advisor/students']) add(path,'get','Students','Staff/advisor: นักศึกษาที่มีสิทธิ์เข้าถึง',array('User'));
for (const path of ['/students/{id}','/advisor/students/{id}']) add(path,'get','Students','รายละเอียดนักศึกษาและใบสมัครตามสิทธิ์',ref('User'));
add('/students/me','get','Students','Student: ข้อมูลตนเอง',ref('User'));
add('/students/me','put','Students','Student: บันทึก GPAX เบอร์โทร transcript หลักสูตร เกรดรายวิชา และการรับทราบ',ref('User'),'StudentWrite');
v3Schemas.StaffStudentWrite = record({...v3Schemas.StudentWrite.properties,advisor_id:integer(true)});
add('/students/{id}','put','Students','Student owner/staff: แก้ไขข้อมูลนักศึกษา (advisor_id เฉพาะ staff)',ref('User'),'StaffStudentWrite');
add('/students/{id}/advisor','put','Students','Staff: กำหนดอาจารย์ที่ปรึกษาที่ active',ref('User'),'AdvisorWrite');
v3Schemas.AdvisorWrite = record({advisor_id:integer(true)},['advisor_id']);
add('/terms','get','Terms','ภาคการศึกษาทั้งหมด',array('Term'));
add('/terms/active','get','Terms','ภาคที่ active หรือ null',{...ref('Term'),nullable:true});
add('/terms','post','Terms','Staff: เพิ่มภาคที่ยังไม่ active',array('Term'),'TermWrite',{status:201});
add('/terms/{id}','put','Terms','Staff: แก้ไขภาคการศึกษา',array('Term'),'TermWrite');
add('/terms/{id}/activate','post','Terms','Staff: เปลี่ยน active term แบบ atomic',array('Term'));
add('/companies','post','Companies','Staff: สร้างสถานประกอบการ',ref('Company'),'CompanyWrite',{status:201});
add('/companies/{id}','put','Companies','Staff/company owner: แก้ไขสถานประกอบการ',ref('Company'),'CompanyWrite');
add('/companies/{id}','delete','Companies','Staff: ลบเมื่อไม่มีผู้ประสานงาน/ใบสมัคร',null,null,{status:204});
add('/staff/companies/{id}','get','Companies','Staff: บริษัทพร้อมรายชื่อผู้ประสานงาน',ref('Company'));
add('/company/profile','get','Companies','Company: บริษัทของตนเองพร้อมผู้ประสานงาน',ref('Company'));
add('/company/profile','put','Companies','Company: บันทึกบริษัทของตนเอง',ref('Company'),'CompanyWrite');
for (const prefix of ['/positions','/company/positions']) {
  add(prefix,'get','Positions','Staff/company: ตำแหน่งตามสิทธิ์',array('Position'),null,{parameters:prefix==='/positions' ? [{name:'company_id',in:'query',schema:integer()}] : []});
  add(prefix,'post','Positions','เพิ่มตำแหน่ง (staff ระบุ company_id; company ใช้บริษัทตนเอง)',ref('Position'),'PositionWrite',{status:201});
  for (const method of ['put','patch']) add(`${prefix}/{id}`,method,'Positions','แก้ไขตำแหน่งตามสิทธิ์',ref('Position'),'PositionWrite');
  add(`${prefix}/{id}`,'delete','Positions','ลบตำแหน่งเมื่อยังไม่มีใบสมัคร',null,null,{status:204});
}
for (const path of ['/applications','/students/me/applications','/advisor/applications','/staff/applications','/company/applications']) add(path,'get','Applications','ใบสมัครตามเจ้าของข้อมูล (company ไม่เห็นใบที่ยังไม่อนุมัติ)',array('Application'),null,{parameters:[{name:'term_id',in:'query',schema:integer()},{name:'status',in:'query',schema:v3Schemas.Application.properties.status}]});
add('/applications','post','Applications','Student: ตรวจ GPAX/เอกสาร/วันรับสมัครและสร้างใบสมัคร; ส่งซ้ำคืนใบเดิม',ref('Application'),'ApplicationWrite',{status:201});
paths['/api/applications'].post.responses[200] = {description:'ส่งซ้ำโดยไม่เพิ่มใบสมัครหรือประวัติ',content:json(ref('Application'))};
add('/applications/{id}','get','Applications','รายละเอียดพร้อม reviews/history ตามสิทธิ์',ref('Application'));
add('/applications/{id}/reviews','post','Applications','Advisor ที่ดูแล/staff: อนุมัติหรือปฏิเสธพร้อม comment',ref('Application'),'ReviewWrite');
add('/company/applications/{id}/decision','patch','Applications','Company owner: approved → accepted/declined',ref('Application'),'DecisionWrite');
for (const action of ['confirm','withdraw']) add(`/applications/{id}/${action}`,'post','Applications',`Student owner: ${action} แบบ atomic และรันซ้ำได้`,ref('Application'));
add('/documents','post','Documents','Student: อัปโหลด PDF local ไม่เกิน 10 MB (development only)',{type:'object',properties:{key:string(512),url:string()}},'unused',{status:201,binary:true,parameters:[{name:'kind',in:'query',required:true,schema:{type:'string',enum:['transcript','resume']}}]});
add('/documents/{key}','get','Documents','ดาวน์โหลดเอกสารตามสิทธิ์ (development only)',null,null,{parameters:[{name:'key',in:'path',required:true,schema:{type:'string'}}]});
paths['/api/documents/{key}'].get.responses[200] = {description:'PDF preview (inline; authenticated)',content:{'application/pdf':{schema:{type:'string',format:'binary'}}}};
export const v3Paths = paths;
