import PagePlaceholder from '../../components/PagePlaceholder';

export default function ManagePositions() {
  return (
    <PagePlaceholder
      title="จัดการตำแหน่งงาน"
      todo={[
        'ดูตำแหน่งของทุกบริษัท กรองตามภาค / บริษัท',
        'แก้ไข / ปิดรับ / ลบ แทนบริษัทได้ (เช่น บริษัทที่ยังไม่มีบัญชีผู้ประสานงาน)',
        'บริษัทเป็นผู้เพิ่มตำแหน่งเอง เจ้าหน้าที่ใช้หน้านี้ตรวจและแก้ไข',
      ]}
    />
  );
}
