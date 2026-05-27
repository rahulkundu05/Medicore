require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const LabTest = require('../models/LabTest');
const { Medicine, MedicineOrder } = require('../models/Medicine');
const Hospital = require('../models/Hospital');
const { Appointment, LabAppointment, EmergencyBooking } = require('../models/Appointment');

async function main() {
  const MONGO_URI = process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGODB_URI is not defined in your .env file!');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB successfully.');

  console.log('\nWiping pre-assigned mock data...');

  try {
    const doctorDeleted = await Doctor.deleteMany({});
    console.log(`🧹 Deleted ${doctorDeleted.deletedCount} doctors`);

    const labDeleted = await LabTest.deleteMany({});
    console.log(`🧹 Deleted ${labDeleted.deletedCount} lab tests`);

    const medicineDeleted = await Medicine.deleteMany({});
    console.log(`🧹 Deleted ${medicineDeleted.deletedCount} medicines`);

    const hospitalDeleted = await Hospital.deleteMany({});
    console.log(`🧹 Deleted ${hospitalDeleted.deletedCount} hospitals`);

    const appointmentDeleted = await Appointment.deleteMany({});
    console.log(`🧹 Deleted ${appointmentDeleted.deletedCount} doctor appointments`);

    const labApptDeleted = await LabAppointment.deleteMany({});
    console.log(`🧹 Deleted ${labApptDeleted.deletedCount} lab appointments`);

    const emergencyDeleted = await EmergencyBooking.deleteMany({});
    console.log(`🧹 Deleted ${emergencyDeleted.deletedCount} emergency bookings`);

    const orderDeleted = await MedicineOrder.deleteMany({});
    console.log(`🧹 Deleted ${orderDeleted.deletedCount} medicine orders`);

    const usersDeleted = await User.deleteMany({});
    console.log(`🧹 Deleted ${usersDeleted.deletedCount} users`);

    console.log('\nSeeding fresh System Admin account...');
    const adminEmail = 'admin@medicore.com';
    await User.create({
      name: 'System Admin',
      age: 30,
      mobile: '9999999999',
      email: adminEmail,
      password: 'admin123',
      role: 'admin',
      isVerified: true,
    });
    
    console.log(`✅ Clean System Admin seeded successfully!`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: admin123`);

    console.log('\n🎉 Database is now completely clean and ready for your own data!');
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('❌ Execution error:', err);
  process.exit(1);
});
