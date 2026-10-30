import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
// Imported for its side effect: the module applies the global Mongoose
// settings, so tests exercise the same configuration the server runs with.
import '../config/db';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('farmfair_test'));

  // Build indexes up front so unique-constraint behaviour matches production.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}, 180000);

afterEach(async () => {
  // Clear documents between tests but keep the indexes: rebuilding them is slow
  // and they are themselves under test.
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
