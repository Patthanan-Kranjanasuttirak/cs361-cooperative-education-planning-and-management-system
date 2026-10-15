import { MIN_GPAX, isGpaxEligible } from '../config/coopRules';
import './CSS/GpaxValue.css';

// แสดง GPAX: ไม่มีข้อมูล = "-" สีเทา, ต่ำกว่าเกณฑ์ = สีแดง (วางเมาส์ดูคำอธิบาย)
export default function GpaxValue({ gpax }) {
  if (gpax == null) {
    return <span className="gpax-missing" title="นักศึกษายังไม่กรอก GPAX">-</span>;
  }
  if (!isGpaxEligible(gpax)) {
    return (
      <span className="gpax-below" title={`ต่ำกว่าเกณฑ์สมัครสหกิจ (${MIN_GPAX.toFixed(2)})`}>
        {gpax.toFixed(2)}
      </span>
    );
  }
  return gpax.toFixed(2);
}
