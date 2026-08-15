import { init } from "./ui/race-engine.ts";
import { switchView } from "./ui/ui-manager.ts";
import { setupEventDelegation } from "./ui/event-handlers.ts";

switchView("garage");
setupEventDelegation();
init();
