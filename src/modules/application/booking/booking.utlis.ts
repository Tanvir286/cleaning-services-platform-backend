import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { TanvirStorage } from 'src/common/lib/Disk/TanvirStorage';
import { StringHelper } from 'src/common/helper/string.helper';
import appConfig from 'src/config/app.config';

// Define the available booking slots
export type BookingSlot = 'A' | 'B' | 'C' | 'D';



// find address with latitude and longitude
export async function findAddress(
  prisma: PrismaService,
  address: string,
) {
  const foundLocation = await prisma.location.findFirst({
    where: {
      id: address,
    },
    select: {
      location_name: true,
      latitude: true,
      longitude: true,
    },
  });

  return {
    findlocation_name: foundLocation?.location_name,
    findlatitude: foundLocation?.latitude,
    findlongitude: foundLocation?.longitude,
  }

}


// Define the time slots for booking
export const bookingSlotTimeMap: Record<BookingSlot, { start: string; end: string }> = {
  A: { start: '08:00am', end: '12:00pm' },
  B: { start: '12:00pm', end: '04:00pm' },
  C: { start: '04:00pm', end: '08:00pm' },
  D: { start: '08:00pm', end: '12:00am' },
};

// Convert time strings (e.g. '08:00am', '12:00pm', '03:00pm', '12:00am') into minutes from midnight
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().toLowerCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!match) return 0;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];

  if (period === 'pm' && hours !== 12) {
    hours += 12;
  } else if (period === 'am' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

// slot with duration and status
export function getSoltWithTitle(title?: string | null) {
  if (!title) return null;
  const normalized = title.trim().toLowerCase();

  if (normalized.includes('ecorefresh') || normalized.includes('refresh')) {
    return {
      title: 'EcoFresh Clean',
      duration: '3 hours',
      status: 'available',
      slot: [
        { slot: 'A', start: '08:00am', end: '11:00am', status: 'available' },
        { slot: 'B', start: '11:00am', end: '02:00pm', status: 'available' },
        { slot: 'C', start: '02:00pm', end: '05:00pm', status: 'available' },
        { slot: 'D', start: '05:00pm', end: '08:00pm', status: 'available' },
      ],
    };
  } else if (
    normalized.includes('ecorestore') ||
    normalized.includes('restore') ||
    normalized.includes('deep clean')
  ) {
    return {
      title: 'EcoRestore Deep Clean',
      duration: '5 hours',
      status: 'available',
      slot: [
        { slot: 'A', start: '08:00am', end: '01:00pm', status: 'available' },
        { slot: 'B', start: '01:00pm', end: '06:00pm', status: 'available' },
        { slot: 'C', start: '06:00pm', end: '11:00pm', status: 'available' },
      ],
    };
  } else if (
    normalized.includes('ecoelite') ||
    normalized.includes('elite') ||
    normalized.includes('premium')
  ) {
    return {
      title: 'EcoElite Premium Clean',
      duration: '7 hours',
      status: 'available',
      slot: [
        { slot: 'A', start: '08:00am', end: '03:00pm', status: 'available' },
        { slot: 'B', start: '03:00pm', end: '10:00pm', status: 'available' },
      ],
    };
  }

  return null;
}

// Get time interval in minutes from midnight for a given package title and slot (A, B, C, D)
export function getSlotTimeInterval(
  packageTitle?: string | null,
  slot?: string | null,
): { start: number; end: number } | null {
  if (!slot) return null;

  if (packageTitle) {
    const config = getSoltWithTitle(packageTitle);
    if (config?.slot) {
      const slotItem = config.slot.find((s) => s.slot === slot);
      if (slotItem) {
        const start = timeStringToMinutes(slotItem.start);
        let end = timeStringToMinutes(slotItem.end);
        if (end <= start) {
          end += 24 * 60;
        }
        return { start, end };
      }
    }
  }

  // Fallback to default slot mapping
  const fallback = bookingSlotTimeMap[slot as BookingSlot];
  if (fallback) {
    const start = timeStringToMinutes(fallback.start);
    let end = timeStringToMinutes(fallback.end);
    if (end <= start) {
      end += 24 * 60;
    }
    return { start, end };
  }

  return null;
}

// Check whether two time intervals overlap: [start1, end1) and [start2, end2)
export function doIntervalsOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number,
): boolean {
  return start1 < end2 && start2 < end1;
}

// Function to format booking date
// Use UTC date parts to avoid timezone shift when displaying dates.
export function formatBookingDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Function to resolve package details based on package ID
export async function resolvePackage(prisma: PrismaService, packageId: string) {
  const residentialPackage = await prisma.residentialCleaningPackage.findUnique({ where: { id: packageId } });

  if (residentialPackage) {
    return {
      residential_cleaning_package_id: residentialPackage.id,
      title: residentialPackage.title,
      total_price: residentialPackage.price ? Number(residentialPackage.price) : null,
    };
  }

  throw new NotFoundException('Selected package not found');
}

// Function to validate maid availability and booking constraints
export async function validateMaid(
  prisma: PrismaService,
  maidId: string,
  userId: string,
) {
  const maid = await prisma.user.findUnique({ where: { id: maidId } });

  if (!maid) {
    throw new NotFoundException('Maid not found');
  }

  if (maid.type !== 'MAID') {
    throw new BadRequestException('Selected user is not a maid');
  }

  if (maidId === userId) {
    throw new BadRequestException('You cannot book yourself');
  }
}

// Function to check if the selected slot is available for booking based on actual time overlap
export async function checkSlotAvailability(
  prisma: PrismaService,
  maidId: string,
  bookingDate: Date,
  slot: string,
  packageId?: string,
) {
  let candidateTitle: string | null = null;
  if (packageId) {
    const pkg = await prisma.residentialCleaningPackage.findUnique({
      where: { id: packageId },
      select: { title: true },
    });
    candidateTitle = pkg?.title ?? null;
  }

  const candidateInterval = getSlotTimeInterval(candidateTitle, slot);

  const existingBookings = await prisma.booking.findMany({
    where: {
      maid_id: maidId,
      booking_date: bookingDate,
      status: {
        notIn: ['CANCELLED', 'REJECTED'],
      },
    },
    select: {
      slot: true,
      residential_cleaning_package: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!candidateInterval) {
    const hasSameSlot = existingBookings.some((b) => b.slot === slot);
    if (hasSameSlot) {
      throw new BadRequestException(
        'This maid is already booked for the selected date and slot',
      );
    }
    return;
  }

  for (const existing of existingBookings) {
    const existingInterval = getSlotTimeInterval(
      existing.residential_cleaning_package?.title,
      existing.slot,
    );

    if (existingInterval) {
      if (
        doIntervalsOverlap(
          candidateInterval.start,
          candidateInterval.end,
          existingInterval.start,
          existingInterval.end,
        )
      ) {
        throw new BadRequestException(
          'This maid is already booked during this time slot on the selected date',
        );
      }
    } else if (existing.slot === slot) {
      throw new BadRequestException(
        'This maid is already booked for the selected date and slot',
      );
    }
  }
}

// Function to upload booking images 
export async function uploadBookingImages(
  imageFiles: Express.Multer.File[] = [],
): Promise<string[]> {
  const uploadedFiles: string[] = [];

  for (const image of imageFiles) {
    const fileName = `${StringHelper.randomString()}_${image.originalname}`;
    await TanvirStorage.put(
      `${appConfig().storageUrl.booking}/${fileName}`,
      image.buffer,
    );
    uploadedFiles.push(fileName);
  }

  return uploadedFiles;
}

// check balance
export async function checkBalance(prisma: PrismaService, userId: string) {

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });

  return user?.balance ?? 0;
  
}

// check commission
export async function checkCommission(
  prisma: PrismaService,
  balance: number | Decimal,
) {
  const commission = await prisma.commission.findFirst({
    orderBy: { created_at: 'desc' },
    select: { percentage: true },
  });

  const percentage = Number(commission?.percentage ?? 0);
  const balanceValue = Number(balance ?? 0);
  const amount = Number(((balanceValue * percentage) / 100).toFixed(2));

  return {
    percentage,
    amount,
  };
}

// check package deatils
export async function checkPackageDeatils(
  prisma: PrismaService,
  packageId: string,
) {
  const cleaningPackage =
    await prisma.residentialCleaningPackage.findUnique({
      where: { id: packageId },
    });

  if (!cleaningPackage) {
    throw new NotFoundException('Package not found');
  }

  return {
    id: cleaningPackage.id,
    name: cleaningPackage.title,
    title: cleaningPackage.title,
    price: cleaningPackage.price ? Number(cleaningPackage.price) : null,
    description: cleaningPackage.description,
    duration: cleaningPackage.duration,
  };
}
