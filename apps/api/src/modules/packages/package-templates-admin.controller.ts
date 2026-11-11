import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PrismaService } from "../../common/prisma.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { Role } from "@prisma/client";
import { Decimal } from "decimal.js";
import {
  validatePackageTemplateForPublish,
  quotePackagePrice,
} from "./package-v2-pricing.util";

@ApiTags("Admin Package Templates")
@Controller("admin/package-templates")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PackageTemplatesAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "List All Package Templates (Admin)" })
  async listTemplates(@Query("platform") platform?: string) {
    const where: any = {};
    if (platform) where.platform = platform.toUpperCase();

    const templates = await this.prisma.packageTemplate.findMany({
      where,
      include: {
        tiers: {
          include: {
            items: {
              include: {
                service: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                    status: true,
                    isDeleted: true,
                    packageEligible: true,
                    minQty: true,
                    maxQty: true,
                    ratePer1000: true,
                    providerCostPer1k: true,
                    kind: true,
                  },
                },
              },
            },
          },
          orderBy: { version: "asc" },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    return templates;
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Single Package Template with Validation Status (Admin)" })
  async getTemplate(@Param("id") id: string) {
    const template = await this.prisma.packageTemplate.findUnique({
      where: { id },
      include: {
        tiers: {
          include: {
            items: {
              include: {
                service: true,
              },
            },
          },
          orderBy: { version: "asc" },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found.`);
    }

    // Run publish validator
    const validation = validatePackageTemplateForPublish({
      status: template.active ? "ACTIVE" : "DRAFT",
      scope: "MULTI_POST",
      tiers: template.tiers.map((t) => ({
        id: t.id,
        version: t.version,
        soldCount: t.soldCount,
        pricePaise: Math.round(new Decimal(t.price.toString()).toNumber() * 100),
        items: t.items.map((i) => ({
          serviceId: i.serviceId,
          quantity: i.quantity,
          service: i.service,
        })),
      })),
    });

    return {
      template,
      validation,
    };
  }

  @Post()
  @ApiOperation({ summary: "Create Package Template (DRAFT)" })
  async createTemplate(
    @Body()
    body: {
      platform: string;
      slug: string;
      name: string;
      description?: string;
      badge?: string;
      displayOrder?: number;
    }
  ) {
    if (!body.platform || !body.slug || !body.name) {
      throw new BadRequestException("Platform, slug, and name are required.");
    }

    const existing = await this.prisma.packageTemplate.findUnique({
      where: { slug: body.slug },
    });
    if (existing) {
      throw new ConflictException(`Template slug '${body.slug}' is already taken.`);
    }

    return this.prisma.packageTemplate.create({
      data: {
        platform: body.platform.toUpperCase(),
        slug: body.slug.toLowerCase().trim(),
        name: body.name.trim(),
        description: body.description?.trim(),
        badge: body.badge?.trim(),
        displayOrder: body.displayOrder || 0,
        active: false, // Created as DRAFT
      },
    });
  }

  @Put(":id")
  @ApiOperation({ summary: "Update Package Template Metadata" })
  async updateTemplate(
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      badge?: string;
      displayOrder?: number;
    }
  ) {
    return this.prisma.packageTemplate.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        description: body.description?.trim(),
        badge: body.badge?.trim(),
        displayOrder: body.displayOrder,
      },
    });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete or Archive Package Template (Admin)" })
  async deleteTemplate(@Param("id") id: string) {
    const template = await this.prisma.packageTemplate.findUnique({
      where: { id },
      include: { tiers: true },
    });
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found.`);
    }

    const hasSales = template.tiers.some((t) => t.soldCount > 0);
    if (hasSales) {
      // Archive instead of hard delete to preserve historical integrity
      return this.prisma.packageTemplate.update({
        where: { id },
        data: { active: false, archived: true },
      });
    }

    return this.prisma.packageTemplate.delete({
      where: { id },
    });
  }

  @Post(":id/toggle-active")
  @ApiOperation({ summary: "Toggle Package Template Active Status" })
  async toggleActive(@Param("id") id: string) {
    const template = await this.prisma.packageTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException(`Template ${id} not found.`);

    return this.prisma.packageTemplate.update({
      where: { id },
      data: { active: !template.active },
    });
  }

  @Post(":id/validate")
  @ApiOperation({ summary: "Validate Template for Publishing & Margin Previews" })
  async validateTemplate(@Param("id") id: string) {
    const template = await this.prisma.packageTemplate.findUnique({
      where: { id },
      include: {
        tiers: {
          include: {
            items: {
              include: {
                service: true,
              },
            },
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template ${id} not found.`);
    }

    const validation = validatePackageTemplateForPublish({
      status: "ACTIVE",
      scope: "MULTI_POST",
      tiers: template.tiers.map((t) => ({
        id: t.id,
        version: t.version,
        soldCount: t.soldCount,
        pricePaise: Math.round(new Decimal(t.price.toString()).toNumber() * 100),
        items: t.items.map((i) => ({
          serviceId: i.serviceId,
          quantity: i.quantity,
          service: i.service,
        })),
      })),
    });

    return validation;
  }

  @Post(":id/publish")
  @ApiOperation({ summary: "Publish Package Template (Enforces All Validation Rules)" })
  async publishTemplate(@Param("id") id: string) {
    const template = await this.prisma.packageTemplate.findUnique({
      where: { id },
      include: {
        tiers: {
          include: {
            items: {
              include: {
                service: true,
              },
            },
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template ${id} not found.`);
    }

    const validation = validatePackageTemplateForPublish({
      status: "ACTIVE",
      scope: "MULTI_POST",
      tiers: template.tiers.map((t) => ({
        id: t.id,
        version: t.version,
        soldCount: t.soldCount,
        pricePaise: Math.round(new Decimal(t.price.toString()).toNumber() * 100),
        items: t.items.map((i) => ({
          serviceId: i.serviceId,
          quantity: i.quantity,
          service: i.service,
        })),
      })),
    });

    if (!validation.valid) {
      throw new BadRequestException({
        message: "Template cannot be published due to validation errors.",
        errors: validation.errors,
      });
    }

    return this.prisma.packageTemplate.update({
      where: { id },
      data: {
        active: true,
        archived: false,
      },
    });
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Archive Package Template" })
  async archiveTemplate(@Param("id") id: string) {
    return this.prisma.packageTemplate.update({
      where: { id },
      data: {
        active: false,
        archived: true,
      },
    });
  }

  @Post(":id/tiers")
  @ApiOperation({ summary: "Add Tier to Package Template" })
  async addTier(
    @Param("id") id: string,
    @Body()
    body: {
      name: string;
      price: number;
      durationDays?: number;
      items?: Array<{
        serviceId: string;
        quantity: number;
        kind?: string;
        allocationBp?: number;
      }>;
    }
  ) {
    if (!body.name || typeof body.price !== "number" || body.price <= 0) {
      throw new BadRequestException("Name and positive price are required.");
    }

    return this.prisma.$transaction(async (tx) => {
      const template = await tx.packageTemplate.findUnique({ where: { id } });
      if (!template) throw new NotFoundException(`Template ${id} not found.`);

      const tier = await tx.packageTemplateTier.create({
        data: {
          templateId: id,
          name: body.name.trim(),
          price: new Decimal(body.price),
          durationDays: body.durationDays || 7,
          version: 1,
          soldCount: 0,
          active: true,
        },
      });

      if (body.items && body.items.length > 0) {
        for (const it of body.items) {
          await tx.packageTemplateItem.create({
            data: {
              tierId: tier.id,
              serviceId: it.serviceId,
              quantity: it.quantity,
              kind: (it.kind as any) || "OTHER",
              allocationBp: it.allocationBp || 0,
            },
          });
        }
      }

      return tier;
    });
  }

  @Put(":id/tiers/:tierId")
  @ApiOperation({ summary: "Update Tier (Enforces Immutability if soldCount > 0)" })
  async updateTier(
    @Param("id") id: string,
    @Param("tierId") tierId: string,
    @Body()
    body: {
      name?: string;
      price?: number;
      durationDays?: number;
      active?: boolean;
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const tier = await tx.packageTemplateTier.findUnique({
        where: { id: tierId },
        include: { items: true },
      });
      if (!tier) throw new NotFoundException(`Tier ${tierId} not found.`);

      // SPEC §5.5 Tier Immutability Guard:
      // If soldCount > 0, do not mutate in place! Archive old and create version + 1.
      if (tier.soldCount > 0) {
        // Deactivate old tier
        await tx.packageTemplateTier.update({
          where: { id: tierId },
          data: { active: false },
        });

        // Create new immutable version
        const newTier = await tx.packageTemplateTier.create({
          data: {
            templateId: id,
            name: body.name || tier.name,
            price: typeof body.price === "number" ? new Decimal(body.price) : tier.price,
            durationDays: body.durationDays || tier.durationDays,
            version: tier.version + 1,
            soldCount: 0,
            active: body.active !== undefined ? body.active : true,
          },
        });

        // Copy items over
        for (const item of tier.items) {
          await tx.packageTemplateItem.create({
            data: {
              tierId: newTier.id,
              serviceId: item.serviceId,
              quantity: item.quantity,
              kind: item.kind,
              allocationBp: item.allocationBp,
              displayOrder: item.displayOrder,
            },
          });
        }

        return {
          migratedToNewVersion: true,
          previousVersion: tier.version,
          newTier,
        };
      }

      // If soldCount === 0, direct in-place update is permitted
      return tx.packageTemplateTier.update({
        where: { id: tierId },
        data: {
          name: body.name?.trim(),
          price: typeof body.price === "number" ? new Decimal(body.price) : undefined,
          durationDays: body.durationDays,
          active: body.active,
        },
      });
    });
  }

  @Delete(":id/tiers/:tierId")
  @ApiOperation({ summary: "Delete or Deactivate Tier (Admin)" })
  async deleteTier(
    @Param("id") id: string,
    @Param("tierId") tierId: string
  ) {
    const tier = await this.prisma.packageTemplateTier.findUnique({
      where: { id: tierId },
    });
    if (!tier) throw new NotFoundException(`Tier ${tierId} not found.`);

    if (tier.soldCount > 0) {
      return this.prisma.packageTemplateTier.update({
        where: { id: tierId },
        data: { active: false },
      });
    }

    return this.prisma.packageTemplateTier.delete({
      where: { id: tierId },
    });
  }

  @Post(":id/tiers/:tierId/items")
  @ApiOperation({ summary: "Add Item to Tier (Admin)" })
  async addItemToTier(
    @Param("id") id: string,
    @Param("tierId") tierId: string,
    @Body()
    body: {
      serviceId: string;
      quantity: number;
      kind?: string;
      allocationBp?: number;
    }
  ) {
    if (!body.serviceId || !body.quantity || body.quantity <= 0) {
      throw new BadRequestException("Service ID and positive quantity are required.");
    }

    return this.prisma.packageTemplateItem.create({
      data: {
        tierId,
        serviceId: body.serviceId,
        quantity: body.quantity,
        kind: (body.kind as any) || "OTHER",
        allocationBp: body.allocationBp || 0,
      },
      include: {
        service: true,
      },
    });
  }

  @Delete(":id/tiers/:tierId/items/:itemId")
  @ApiOperation({ summary: "Remove Item from Tier (Admin)" })
  async removeItemFromTier(
    @Param("id") id: string,
    @Param("tierId") tierId: string,
    @Param("itemId") itemId: string
  ) {
    return this.prisma.packageTemplateItem.delete({
      where: { id: itemId },
    });
  }
}
