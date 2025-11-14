// File ini bertindak sebagai "barrel" (eksporter utama) untuk folder database.
// Ini memungkinkan kita mengimpor dari 'src/database' alih-alih 'src/database/schema.js'
import { db, initializeDatabase } from './schema.js';

export { db, initializeDatabase };