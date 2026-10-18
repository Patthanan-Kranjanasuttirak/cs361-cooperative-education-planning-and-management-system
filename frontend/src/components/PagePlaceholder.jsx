import './CSS/PagePlaceholder.css';

// หน้าชั่วคราวที่บอกว่าหน้านี้ต้องทำอะไรบ้าง ลบออกเมื่อทำหน้าจริงเสร็จ
export default function PagePlaceholder({ title, todo = [] }) {
  return (
    <section>
      <h1 className="placeholder-title">{title}</h1>
      <p className="placeholder-note">หน้านี้ยังไม่ได้ทำ — สิ่งที่ต้องมี:</p>
      <ul className="placeholder-todo">
        {todo.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
