// Pure native Base64 decoding without external dependencies

const token = "P1_eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.3gAHp3Bhc3NrZXnFBNjCErqegmmY0AhTQAqKklE1TDDUD9RZ7CwfA8QQQqB2iYxCuZAa2nsUlvG_BDo-4ToyBCV7qI-AYLwi5XrlK54eJ64Dy7BYsf3iIbZ42hcprxlN2XuvfcJG1ZQLJ6wg4WSr1E0zbXJxq4znnxSnkRwvWri2_OzdeDTe6-VVfN5Gt1sEMblDl4yTqUGAz1jK049VI4c3qnopE7hWuHXefpFz9rcJB3JGuOcCZSMmgKFLVmDkWZuzQ8UbWIbEoMXoIVRj6LtGVhyXH3xvLg8LjTEVKX2knLaX-t8mHVZN4y0Tq-R7byE84YfgKVKXd4DHMOqaQs_Djpz0HOvOsE1nItmnCkn8bdRb_g9RaVB7ekzONBygwxKvHrphCbWdDo7GH041LJcRYORjMP6gMGDV9I4EBnV_do5-AIKn4gZPHHoTvB7W65d0KfbUm99x6DaqUDEXQUHaG32_G8NgjzdFlS9i1hAAWNXpS3yO5uJXZgXm1uYXXYx8gJgfieas-Gnq9E85pC-n43KcSpIpUceXSSlMJG9-1TyFIq0oqhrjtGYovAhPd0sXjI8RrSnVzSo98ewBEBNmRfJiWZ_jNcAiGg0Cm1CiMU5sQNjhopl5OZneTMeW5E47h8cy2seuzvhuQEg4RQiNhEgkMxpaUJIMrkh0SRymcUZ05O8DZvPyKSJVVk0d7kleVaZ25Vhy8hO4pUi0mhecUddfsvz7eDwPVpSuLbpMGmxoLKZizXRjWQtDx1KK1vzWb7dheg3o8P-6geTruEXXQDoH_bT5yReMhxq91enrCsonhSyZtgZfFAwQbtIocRjArxySxjgbnwTAID5zR0cNgolAf42EhQv0gw7Tx9yU0A6Y2dATxOeamXI6GLos_oys5PWiQ8jPEmldBow-H7wkBJ90ft1_Uj9q4AjU59e7iB5O8OXYxsc0saD7qTCEhjyEbX83YNzLI04TKO8e3xgkC_aBrVCiiGFBCmXTpUdN7Rd0Zxvo3leiA0JQi-fxP1fivkx2jbuUT8CIjudLSrufKf0TaZRAOm3rOmxgArF29-P-XFtpwZEUeuH-sxBqEg4cCAc1ZxgZ2-VTkZ6rgkfMhNW8lw0y2cU8XFVHFUlJSapT6DSA6u-bdDEYrw4EsPEaqN6OEu8Qtx-DAwjS8Q6ufzcBEBNOLCRVuTIaMCKLHyOcwNnt6oLbkdBeVJfmHO0Yh_ualZ0pK456yGEZLQaq19Rt5WHqqXDGJrDhweKW-Q4Rn0asLa4fZxjEr_mcxWERS5Bqc8OYDqwydTbN7cpy0pJEWS60BDUBs2h13QoeNyWJoyIp3FANBj2KTDc9-fdllrv_MPO2uA0LhPFIHhqXdFAwfjg_KKRnktmw4Jpr2QHJgehqBJY0wp2mkI74yGzABL-AlORFNe8wdcLulbXg58ul6yZjgZ4KSDUNOx91crwEa_vg3vf5YX1mtiPuLuad5XviJnE3YR3uhM2KTwr6iRP-wxTTwRw6uozhIuHJRy5oEVVZDmnJ7xBH64vqBadnhhrpPrBaIIBc4HqgD3mdneOcSZkVvUfahhvpIUcaZIM_zps0bOEOXU7HdtR9sQe3hWy0O4qTAmAUPXPZqVtQMKhWRjzLFWv597U3hpTtxBV-WW9gfxOgW3i-JzXllsHeLYQgp3NpdGVrZXnZJGI4YmJkZWQxLTlkMDQtNGFjZS05OTUyLWI2N2NkZTA4MWE3YqNleHDOagr_raJwZAClY2RhdGHUAACmY2RhdGEy1AAAomtyqDQ2ZjVhOTFj.6u908xzm__vwmtgyjIQlDU9Ry2OfYFoEuuOg2WOabdY";

function decodeJwt() {
    console.log('🔓 Decodificando Token do Captcha...');
    
    // Remove o prefixo "P1_" se existir
    const rawJwt = token.startsWith('P1_') ? token.substring(3) : token;
    
    const parts = rawJwt.split('.');
    if (parts.length < 2) {
        console.error('❌ Formato de JWT inválido!');
        return;
    }

    try {
        // Decodifica o Header
        const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
        console.log('\nHeader:', JSON.stringify(header, null, 2));

        // Decodifica o Payload
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        console.log('\nPayload:', JSON.stringify(payload, null, 2));
    } catch (e) {
        console.log('\n⚠️ Erro ao decodificar em JSON direto. Tentando extração de strings limpas...');
        try {
            const decodedString = Buffer.from(parts[1], 'base64').toString('utf8');
            console.log('\nDados Brutos decodificados:', decodedString);
        } catch (err) {
            console.error('❌ Falha total na decodificação:', err.message);
        }
    }
}

decodeJwt();
