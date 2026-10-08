import { AuthValidation } from '../src/app/modules/auth/auth.validation';

const main = () => {
  console.log('Testing Promoter Registration (no business name)...');
  const promoterResult = AuthValidation.registerSchema.safeParse({
    body: {
      name: 'Promoter Test',
      email: 'promoter@example.com',
      password: 'Password1!',
      phone: '1234567890',
      role: 'PROMOTER',
    },
  });

  if (promoterResult.success) {
    console.log('✅ Promoter registration validated successfully!');
  } else {
    console.error('❌ Promoter registration failed:', promoterResult.error.format());
  }

  console.log('\nTesting Business Owner Registration (no business name)...');
  const bizOwnerFailResult = AuthValidation.registerSchema.safeParse({
    body: {
      name: 'Biz Owner Test',
      email: 'biz@example.com',
      password: 'Password1!',
      phone: '1234567890',
      role: 'BUSINESS_OWNER',
    },
  });

  if (!bizOwnerFailResult.success) {
    console.log('✅ Business Owner correctly failed without business name!');
  } else {
    console.error('❌ Business Owner unexpectedly succeeded without business name!');
  }

  console.log('\nTesting Business Owner Registration (with business name)...');
  const bizOwnerPassResult = AuthValidation.registerSchema.safeParse({
    body: {
      name: 'Biz Owner Test',
      email: 'biz@example.com',
      password: 'Password1!',
      phone: '1234567890',
      role: 'BUSINESS_OWNER',
      businessName: 'My Business Inc',
    },
  });

  if (bizOwnerPassResult.success) {
    console.log('✅ Business Owner registration validated successfully with business name!');
  } else {
    console.error('❌ Business Owner registration failed:', bizOwnerPassResult.error.format());
  }
};

main();
