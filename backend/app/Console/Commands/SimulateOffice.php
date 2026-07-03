<?php

namespace App\Console\Commands;

use App\Models\Device;
use Illuminate\Console\Command;

class SimulateOffice extends Command
{
    protected $signature = 'office:simulate';
    protected $description = 'Simulate real-time office device changes';

    public function handle()
    {
        $this->info('Starting Office Simulation...');

        while (true) {
            // Randomly pick a device to toggle
            $device = Device::inRandomOrder()->first();
            if ($device) {
                $device->status = !$device->status;
                $device->last_changed_at = now();
                $device->save();

                $this->line("Toggled {$device->name} in {$device->room} to " . ($device->status ? 'ON' : 'OFF'));
            }

            sleep(5);
        }
    }
}
