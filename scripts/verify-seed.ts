import { connectDB, disconnectDB } from './seeder/seeder.config';
import { User } from '../src/app/modules/user/user.model';
import { Vehicle } from '../src/app/modules/vehicle/vehicle.model';
import { Job } from '../src/app/modules/job/job.model';
import { Chat } from '../src/app/modules/chat/chat.model';
import { Message } from '../src/app/modules/message/message.model';

async function verify() {
  await connectDB();

  console.log('\n=================== USER SUMMARY ===================');
  const users = await User.find({}).select('name email role companyRole appState accountState averageRating totalReviews selectedVehicle');
  for (const u of users) {
    console.log(`[${u.role}/${u.companyRole || 'N/A'}] ${u.name} (${u.email}) - Rating: ${u.averageRating}★ (${u.totalReviews} reviews) - AppState: ${u.appState}`);
  }

  console.log('\n=================== VEHICLE SUMMARY ===================');
  const vehicles = await Vehicle.find({}).select('driverId makeAndModel year licensePlate');
  for (const v of vehicles) {
    console.log(`Vehicle: ${v.makeAndModel} (${v.year}, ${v.licensePlate}) -> Driver: ${v.driverId}`);
  }

  console.log('\n=================== JOBS & APPLICATIONS SUMMARY ===================');
  const jobs = await Job.find({}).populate('applicant.driver', 'name').populate('createdBy', 'name').populate('assignedTo', 'name');
  for (const j of jobs) {
    const applicantName = (j.applicant?.driver as any)?.name || 'None';
    const creatorName = (j.createdBy as any)?.name || 'Unknown';
    const assignedName = (j.assignedTo as any)?.name || 'Unassigned';
    console.log(`Job [${j.status}/${j.rideStatus || 'NO_RIDE_STATUS'}]: ${j.pickup.substring(0, 35)}... | Creator: ${creatorName} | Assigned: ${assignedName} | Applicant: ${applicantName} | Reviews: Driver=${!!j.reviewByDriver?.rating}, Creator=${!!j.reviewByCreator?.rating}`);
  }

  console.log('\n=================== CHATS & MESSAGES SUMMARY ===================');
  const chats = await Chat.find({}).populate('participants', 'name');
  for (const c of chats) {
    const count = await Message.countDocuments({ chatId: c._id });
    const partNames = (c.participants as any[]).map(p => p.name).join(' & ');
    console.log(`Chat: ${partNames} | JobId: ${c.jobId} | ${count} messages | Last: "${c.lastMessage}"`);
  }

  await disconnectDB();
}

verify();
