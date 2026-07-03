<?php

namespace Database\Seeders;

use App\Models\Device;
use Illuminate\Database\Seeder;

class DeviceSeeder extends Seeder
{
    public function run(): void
    {
        $rooms = ['Drawing Room', 'Work Room 1', 'Work Room 2'];
        
        foreach ($rooms as $room) {
            // 2 Fans per room
            for ($i = 1; $i <= 2; $i++) {
                Device::create([
                    'room' => $room,
                    'type' => 'fan',
                    'name' => "Fan $i",
                    'status' => false,
                    'power_draw' => 60,
                ]);
            }
            // 3 Lights per room
            for ($i = 1; $i <= 3; $i++) {
                Device::create([
                    'room' => $room,
                    'type' => 'light',
                    'name' => "Light $i",
                    'status' => false,
                    'power_draw' => 15,
                ]);
            }
        }
    }
}
