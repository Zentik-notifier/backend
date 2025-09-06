import { Test, TestingModule } from '@nestjs/testing';
import { JwtOrAccessTokenGuard } from '../auth/guards/jwt-or-access-token.guard';
import { Attachment } from '../entities/attachment.entity';
import { MediaType } from '../notifications/notifications.types';
import { AttachmentsDisabledGuard } from './attachments-disabled.guard';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { DownloadFromUrlDto, UploadAttachmentDto } from './dto';
import { ConfigInjectorInterceptor } from './interceptors/config-injector.interceptor';

describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  let attachmentsService: AttachmentsService;

  const mockAttachment: Partial<Attachment> = {
    id: 'attachment-1',
    filename: 'test-file.jpg',
    mediaType: MediaType.IMAGE,
    filepath: '/tmp/test-file.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAttachmentsService = {
    uploadAttachment: jest.fn(),
    downloadAndSaveFromUrl: jest.fn(),
    findOne: jest.fn(),
    findOnePublic: jest.fn(),
    findByMessage: jest.fn(),
    remove: jest.fn(),
  };

  const mockAttachmentsDisabledGuard = {
    canActivate: jest.fn(() => true),
  };

  const mockConfigInjectorInterceptor = {
    intercept: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttachmentsController],
      providers: [
        {
          provide: AttachmentsService,
          useValue: mockAttachmentsService,
        },
      ],
    })
      .overrideGuard(JwtOrAccessTokenGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(AttachmentsDisabledGuard)
      .useValue(mockAttachmentsDisabledGuard)
      .overrideInterceptor(ConfigInjectorInterceptor)
      .useValue(mockConfigInjectorInterceptor)
      .compile();

    controller = module.get<AttachmentsController>(AttachmentsController);
    attachmentsService = module.get<AttachmentsService>(AttachmentsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadAttachment', () => {
    it('should upload an attachment successfully', async () => {
      const uploadDto: UploadAttachmentDto = {
        mediaType: MediaType.IMAGE,
        filename: 'test-image.jpg',
      };

      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test-image.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        destination: '/tmp',
        filename: 'test-image.jpg',
        path: '/tmp/test-image.jpg',
        buffer: Buffer.from('test'),
        stream: {} as any,
      };

      mockAttachmentsService.uploadAttachment.mockResolvedValue(mockAttachment as Attachment);

      const result = await controller.uploadAttachment('user-1', uploadDto, mockFile);

      expect(result).toEqual(mockAttachment);
      expect(attachmentsService.uploadAttachment).toHaveBeenCalledWith(
        'user-1',
        uploadDto,
        mockFile,
      );
    });

    it('should throw error when no file is uploaded', async () => {
      const uploadDto: UploadAttachmentDto = {
        mediaType: MediaType.IMAGE,
        filename: 'test-image.jpg',
      };

      expect(() => controller.uploadAttachment('user-1', uploadDto, null as any)).toThrow('No file uploaded');
    });
  });

  describe('downloadFromUrl', () => {
    it('should download and save attachment from URL successfully', async () => {
      const downloadDto: DownloadFromUrlDto = {
        url: 'https://example.com/image.jpg',
        filename: 'downloaded-image.jpg',
        mediaType: MediaType.IMAGE,
      };

      mockAttachmentsService.downloadAndSaveFromUrl.mockResolvedValue(mockAttachment as Attachment);

      const result = await controller.downloadFromUrl('user-1', downloadDto);

      expect(result).toEqual(mockAttachment);
      expect(attachmentsService.downloadAndSaveFromUrl).toHaveBeenCalledWith(
        'user-1',
        downloadDto.url,
        downloadDto.filename,
        downloadDto.mediaType,
      );
    });
  });

  describe('findOne', () => {
    it('should return an attachment by ID', async () => {
      mockAttachmentsService.findOne.mockResolvedValue(mockAttachment as Attachment);

      const result = await controller.findOne('attachment-1', 'user-1');

      expect(result).toEqual(mockAttachment);
      expect(attachmentsService.findOne).toHaveBeenCalledWith('attachment-1', 'user-1');
    });
  });

  describe('findByMessage', () => {
    it('should return attachments for a specific message', async () => {
      const mockAttachments = [mockAttachment as Attachment];
      mockAttachmentsService.findByMessage.mockResolvedValue(mockAttachments);

      const result = await controller.findByMessage('message-1', 'user-1');

      expect(result).toEqual(mockAttachments);
      expect(attachmentsService.findByMessage).toHaveBeenCalledWith('message-1', 'user-1');
    });
  });

  describe('remove', () => {
    it('should remove an attachment successfully', async () => {
      mockAttachmentsService.remove.mockResolvedValue(undefined);

      await controller.remove('attachment-1', 'user-1');

      expect(attachmentsService.remove).toHaveBeenCalledWith('attachment-1', 'user-1');
    });
  });
});
