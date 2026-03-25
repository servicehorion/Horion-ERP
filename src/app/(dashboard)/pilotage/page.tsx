import { redirect } from "next/navigation";

/**
 * /pilotage redirects to the strategic intelligence view which is the
 * natural landing page for the Pilotage module.
 */
export default function PilotagePage() {
  redirect("/pilotage/intelligence");
}
