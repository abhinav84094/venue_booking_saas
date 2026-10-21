// Production entry points export only the handler. Test factories/constants in
// worker.js must not become named Workers runtime entry points.
import worker from "./worker.js";
export default worker;
