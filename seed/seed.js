require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Doctor   = require('../models/Doctor');
const LabTest  = require('../models/LabTest');
const { Medicine } = require('../models/Medicine');
const Hospital = require('../models/Hospital');

// ── Helpers ───────────────────────────────────────────────────
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Seed Functions ────────────────────────────────────────────
async function seedHospitals() {
  await Hospital.deleteMany({});

  const hospitals = await Hospital.insertMany([
    { name:'City Hospital',        x:10,  y:20,  slots:5,  email:'info@cityhospital.com',       phone:'9876543210', address:'123 Health Ave, Metro City', isApproved:true },
    { name:'Green Valley Clinic',  x:50,  y:60,  slots:3,  email:'contact@greenvalley.com',     phone:'9876543211', address:'456 Meadow Rd, Green Valley', isApproved:true },
    { name:'Metro Health Center',  x:30,  y:10,  slots:8,  email:'care@metrohealth.com',        phone:'9876543212', address:'789 Central Pkwy, Downtown', isApproved:true },
    { name:'Sunrise Hospital',     x:80,  y:20,  slots:2,  email:'help@sunrisehospital.com',    phone:'9876543213', address:'101 Sunrise Blvd, East Hills', isApproved:true },
    { name:'Global Medical Hub',   x:100, y:100, slots:10, email:'support@globalmedhub.com',    phone:'9876543214', address:'202 Infinity Way, Technology Park', isApproved:true },
  ]);

  console.log('✅ Hospitals seeded');
  return hospitals;
}

async function seedDoctors(hospitals) {
  await Doctor.deleteMany({});

  const docSlotTimes = ['10:00','11:00','12:00','14:00','15:00'];
  const rawDoctors = [
    { name:'Dr. Smith',  specialization:'Cardiology',   qualification:'MBBS, MD (Cardiology)' },
    { name:'Dr. John',   specialization:'Dermatology',  qualification:'MBBS, MD (Dermatology)' },
    { name:'Dr. Emily',  specialization:'General',      qualification:'MBBS' },
    { name:'Dr. Brown',  specialization:'Neurology',    qualification:'MBBS, DM (Neurology)' },
    { name:'Dr. Wilson', specialization:'Cardiology',   qualification:'MBBS, DNB (Cardiology)' },
    { name:'Dr. Mehta',  specialization:'Dermatology',  qualification:'MBBS, DDVL' },
    { name:'Dr. Sharma', specialization:'Orthopedics',  qualification:'MBBS, MS (Orthopedics)' },
    { name:'Dr. Kapoor', specialization:'General',      qualification:'MBBS' },
    { name:'Dr. Verma',  specialization:'ENT',          qualification:'MBBS, MS (ENT)' },
    { name:'Dr. Rao',    specialization:'Pediatrics',   qualification:'MBBS, MD (Pediatrics)' },
  ];

  for (let idx = 0; idx < rawDoctors.length; idx++) {
    const raw = rawDoctors[idx];
    const slots = new Map();
    for (let i = 0; i < 31; i++) {
      slots.set(formatDate(addDays(new Date(), i)), [...docSlotTimes]);
    }
    let charge = 500;
    if (raw.specialization === 'Cardiology') charge = 800;
    else if (raw.specialization === 'Dermatology') charge = 600;
    else if (raw.specialization === 'Neurology') charge = 950;
    else if (raw.specialization === 'Orthopedics') charge = 700;
    else if (raw.specialization === 'General') charge = 400;

    const hosp = hospitals[idx % hospitals.length];
    await Doctor.create({ ...raw, slots, charge, available: true, hospitalId: hosp._id });
  }

  console.log('✅ Doctors seeded');
}

async function seedLabTests(hospitals) {
  await LabTest.deleteMany({});

  const labSlotTimes = ['9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
  const rawTests = [
    'Blood Test','Full Body Checkup','Diabetes Test','Thyroid Test',
    'Dengue Test','Malaria Test','Cancer Test','Hairfall Test',
    'Vitamin Deficiency Test','Heart Disease Test','Liver Function Test',
    'Kidney Function Test','Hormones Test',
  ];

  for (let idx = 0; idx < rawTests.length; idx++) {
    const name = rawTests[idx];
    const slots = new Map();
    for (let i = 0; i < 31; i++) {
      slots.set(formatDate(addDays(new Date(), i)), [...labSlotTimes]);
    }
    let charge = 800;
    if (name === 'Full Body Checkup') charge = 2500;
    else if (name === 'Blood Test') charge = 300;
    else if (name === 'Cancer Test') charge = 5000;
    else if (name === 'Heart Disease Test') charge = 2000;
    else if (name === 'Liver Function Test' || name === 'Kidney Function Test') charge = 1500;
    else if (name === 'Diabetes Test' || name === 'Thyroid Test') charge = 600;

    const hosp = hospitals[idx % hospitals.length];
    await LabTest.create({ name, slots, charge, available: true, hospitalId: hosp._id });
  }

  console.log('✅ Lab tests seeded');
}

async function seedMedicines(hospitals) {
  await Medicine.deleteMany({});

  const rawMeds = [
    { name:'Paracetamol',     price:20,  stock:100, desc:'Pain relief & fever reducer' },
    { name:'Azithromycin',    price:120, stock:50,  desc:'Antibiotic for bacterial infections' },
    { name:'Cough Syrup',     price:85,  stock:40,  desc:'Relieves cough and throat irritation' },
    { name:'Vitamin D',       price:60,  stock:70,  desc:'Vitamin D3 supplementation' },
    { name:'Insulin',         price:450, stock:20,  desc:'Blood sugar control for diabetics' },
    { name:'Amoxicillin',     price:55,  stock:80,  desc:'Broad-spectrum antibiotic for infections' },
    { name:'Omeprazole',      price:35,  stock:90,  desc:'Reduces stomach acid & treats reflux' },
    { name:'Ibuprofen',       price:25,  stock:110, desc:'Anti-inflammatory pain & swelling relief' },
    { name:'Atorvastatin',    price:180, stock:60,  desc:'Lowers cholesterol levels & reduces cardiovascular risk' },
    { name:'Metformin',       price:45,  stock:150, desc:'Controls blood sugar levels for Type 2 Diabetes management' },
    { name:'Lisinopril',      price:75,  stock:80,  desc:'ACE inhibitor used to treat high blood pressure & heart failure' },
    { name:'Albuterol Inhaler',price:220, stock:40,  desc:'Fast-acting bronchodilator for asthma & COPD respiratory relief' },
    { name:'Pantoprazole',    price:65,  stock:95,  desc:'Proton pump inhibitor decreasing stomach acid, treating GERD' },
    { name:'Cetirizine',      price:30,  stock:200, desc:'Antihistamine providing 24-hour non-drowsy allergy relief' },
    { name:'Montelukast',     price:110, stock:85,  desc:'Leukotriene receptor antagonist preventing asthma attacks & allergies' },
    { name:'Daily Multivitamin',price:90, stock:100, desc:'Essential daily micronutrient blend supporting immunity & vitality' }
  ];

  const mappedMeds = rawMeds.map((m, idx) => ({
    ...m,
    hospitalId: hospitals[idx % hospitals.length]._id
  }));

  await Medicine.insertMany(mappedMeds);
  console.log('✅ Medicines seeded');
}

async function seedAdmin() {
  const User = require('../models/User');
  const adminEmail = 'admin@medicore.com';
  const exists = await User.findOne({ email: adminEmail });
  if (!exists) {
    await User.create({
      name: 'System Admin',
      age: 30,
      mobile: '9999999999',
      email: adminEmail,
      password: 'admin123',
      role: 'admin',
    });
    console.log('✅ Admin user seeded');
  } else {
    exists.role = 'admin';
    exists.password = 'admin123';
    await exists.save();
    console.log('✅ Admin user verified and synced');
  }
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medicore';
  console.log('Connecting to:', MONGO_URI);

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const hospitals = await seedHospitals();
  await seedDoctors(hospitals);
  await seedLabTests(hospitals);
  await seedMedicines(hospitals);
  await seedAdmin();

  console.log('\n🎉 Database seeded successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
