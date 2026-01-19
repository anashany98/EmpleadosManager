
import nodemailer, { Transporter } from 'nodemailer';
import { prisma } from '../lib/prisma';

interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
}

export class EmailService {
    private static transporter: Transporter | null = null;
    private static lastConfigHash: string = '';

    private static async getConfig(): Promise<SmtpConfig | null> {
        try {
            // Fetch from DB Configuration table
            const configs = await prisma.configuration.findMany({
                where: {
                    key: { in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] }
                }
            });

            // Convert array to map for easier access
            const configMap = configs.reduce((acc, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {} as Record<string, string>);

            if (!configMap['SMTP_HOST']) return null; // Not configured

            return {
                host: configMap['SMTP_HOST'],
                port: parseInt(configMap['SMTP_PORT'] || '587'),
                secure: configMap['SMTP_SECURE'] === 'true',
                user: configMap['SMTP_USER'] || '',
                pass: configMap['SMTP_PASS'] || '',
                from: configMap['SMTP_FROM'] || '"Nominas App" <noreply@nominasapp.com>'
            };
        } catch (error) {
            console.error('Error fetching email config:', error);
            return null;
        }
    }

    private static async getTransporter(): Promise<Transporter> {
        const config = await this.getConfig();

        // If no config in DB, use Ethereal (Fake)
        if (!config) {
            if (!this.transporter || this.lastConfigHash !== 'ethereal') {
                console.log('📧 No SMTP config found. Creating Ethereal test account...');
                const testAccount = await nodemailer.createTestAccount();
                this.transporter = nodemailer.createTransport({
                    host: 'smtp.ethereal.email',
                    port: 587,
                    secure: false,
                    auth: {
                        user: testAccount.user,
                        pass: testAccount.pass,
                    },
                });
                this.lastConfigHash = 'ethereal';
                console.log(`📧 Ethereal Ready: ${testAccount.user}`);
            }
            return this.transporter!;
        }

        // Check if config changed (simple JSON stringify comparison)
        const currentHash = JSON.stringify(config);
        if (this.transporter && this.lastConfigHash === currentHash) {
            return this.transporter;
        }

        // Create new transporter with Real Config
        console.log(`📧 Configuring SMTP: ${config.host}`);
        this.transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.pass,
            },
        });
        this.lastConfigHash = currentHash;
        return this.transporter;
    }

    static async sendMail(to: string, subject: string, html: string, attachments?: any[]) {
        try {
            const transporter = await this.getTransporter();
            const config = await this.getConfig();
            const from = config?.from || '"Nominas App Test" <test@nominasapp.com>';

            const info = await transporter.sendMail({
                from,
                to,
                subject,
                html,
                attachments
            });

            console.log(`✅ Email sent: ${info.messageId}`);

            // If using Ethereal, log the URL
            if (this.lastConfigHash === 'ethereal') {
                console.log(`📬 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
                // You might want to return this URL to the frontend for testing logic
                return { success: true, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
            }

            return { success: true, messageId: info.messageId };
        } catch (error: any) {
            console.error('❌ Error sending email:', error);
            throw new Error(`Error sending email: ${error.message}`);
        }
    }
}
